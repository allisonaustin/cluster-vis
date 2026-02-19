import json
import os
from datetime import datetime

import pandas as pd
from flask import Flask, abort, jsonify, current_app
from flask_cors import CORS

from datetime import datetime
from timeit import default_timer as timer
from concurrent.futures import ThreadPoolExecutor
from scripts.pipeline import get_feat_contributions

from mrdmd import get_mrdmd, get_mrdmd_with_new_base
from scripts.pipeline import (get_dr_time, get_feat_contributions,
                             recompute_clusters)

app = Flask(__name__)
CORS(app)

data_dir = os.path.join(os.path.dirname(__file__), 'data')
ts_data = pd.DataFrame()
headers = pd.DataFrame()
filepath = './data/'
file = 'ganglia_2024-02-21.csv'
CACHE_DIR = './scripts/cache/'
DR1_CACHE_NAME = CACHE_DIR + 'drTimeDataDR1.parquet'
DR2_CACHE_NAME = CACHE_DIR + 'drTimeDataDR2.parquet'
ZSC_B_CACHE_NAME = CACHE_DIR + 'mrDMDbaselineZscores.parquet'
CLUSTER_CACHE_NAME  = CACHE_DIR + 'cluster_assignments.parquet'
streaming_state = {"next_batch_idx": 0}

@app.route('/loadData', methods=['GET'])
def get_timeseries_data(file):
    # TODO: convert to parquet instead of global
    global ts_data
    global filepath
    ts_data = pd.read_csv(filepath+file).fillna(0.0)
    # use below for env logs
    if ('time_secs' in ts_data.columns):
        ts_data['timestamp'] = ts_data['time_secs']
        ts_data.drop(columns=['time_secs'], inplace=True)
    if ('cname_processed' in ts_data.columns):
        ts_data['nodeId'] = ts_data['cname_processed']
        ts_data.drop(columns=['cname_id', 'cname_processed'], inplace=True)
    return ts_data

def clear_caches():
    # print('Clearing caches on startup.')
    if os.path.exists(DR1_CACHE_NAME):
        os.remove(DR1_CACHE_NAME)
    if os.path.exists(DR2_CACHE_NAME):
        os.remove(DR2_CACHE_NAME)
    if os.path.exists(ZSC_B_CACHE_NAME):
        os.remove(ZSC_B_CACHE_NAME)
    # if os.path.exists(CLUSTER_CACHE_NAME):
    #     os.remove(CLUSTER_CACHE_NAME)

def reset_stream():
    global ts_data, streaming_state
    streaming_state["next_batch_idx"] = 0
    ts_data = get_timeseries_data(file)    

@app.route('/headers', methods=['GET'])
def get_headers():
    global headers 

    metadata = []
    headers_dir = os.path.join(data_dir, 'headers')
    try:
        for fname in os.listdir(headers_dir):
            if fname.endswith('.json'):
                with open(os.path.join(headers_dir, fname), 'r', encoding='utf-8') as f:
                    metadata.append(json.load(f))
        return jsonify(metadata)
    except Exception as e:
        return jsonify({"error": "Could not read headers", "details": str(e)}), 500

# PC across time points
@app.route('/drTimeData/<n_neighbors>/<min_dist>/<num_clusters>', methods=['GET'])
def get_dr_data_flask(n_neighbors, min_dist, num_clusters):
    global ts_data

    if ts_data is None or ts_data.empty:
        ts_data = get_timeseries_data(file)

    print("DR data shape:", ts_data.shape)
    
    df = get_dr_time(ts_data, int(n_neighbors), float(min_dist), int(num_clusters), 1)
    df[['nodeId', 'Cluster']].to_parquet(CLUSTER_CACHE_NAME, index=False)
    fc_start = timer()
    agg_feat_contrib_mat, label_to_rows, label_to_rep_row, order_col, = get_feat_contributions(df)
    fc_end = timer()

    print(f'ccpca in {(fc_end - fc_start)}s')

    response = {
        "dr_features": df.to_dict(orient='records'),  # main DR results + ClusterID
        "feat_contributions": {
            "agg_feat_contrib_mat": agg_feat_contrib_mat.tolist(),
            "label_to_rows": [list(rows) for rows in label_to_rows],
            "label_to_rep_row": label_to_rep_row,
            "order_col": order_col
        },
    }
    return jsonify(response)

@app.route('/recomputeClusters/<numClusters>/<n_neighbors>/<min_dist>/<force_recompute>')
def get_new_cluster_ids(numClusters, n_neighbors, min_dist, force_recompute=0):
    global ts_data
    recomputed = recompute_clusters(ts_data, int(numClusters), int(n_neighbors), float(min_dist), int(force_recompute))
    if recomputed is None:
        # DR2 is wiped on startup so recompute_clusters always pulls from fresh DR2 data.
        # recompute_clusters() returns None if DR2 is not found in cache.
        # This error state can happen if you query /recomputeClusters on server startup before /drTimeData,
        # e.g. if the server restarted and # clusters is changed on the frontend without a page refresh.
        abort(404, description="No cached DR2 was found.")
    return jsonify(recomputed)

@app.route('/mrdmd/<nodes>/<selectedCols>/<recompute_base>/<new_base>/<bmin>/<bmax>/<sob>/<eob>', methods=['GET'])
def get_mrdmd_results(nodes, selectedCols, recompute_base=0, new_base=0, bmin=None, bmax=None, sob=None, eob=None):
    global ts_data

    colsList = list([col.replace('%', ' ') for col in selectedCols.split(',') if col.strip()] )
    nodeList = list(set(nodes.split(',')))
    cols = ['timestamp', 'nodeId'] + colsList

    filtered_data = ts_data[ts_data['nodeId'].isin(nodeList)]

    # print('mrdmd:', filtered_data[cols].shape)
    avail_cols = [col for col in cols if col in filtered_data.columns]
    print('mrdmd:', filtered_data[avail_cols].shape)

    if (filtered_data.shape[0] > 0):
        if (int(new_base) == 0):
            zscores, baselines = get_mrdmd(filtered_data[avail_cols], int(recompute_base))
        else:
            start_time = pd.to_datetime(sob)
            end_time = pd.to_datetime(eob)
            zscores, baselines = get_mrdmd_with_new_base(filtered_data[avail_cols], selectedCols, float(bmin), float(bmax), start_time, end_time)
    else: 
        zscores = pd.DataFrame()
        baselines = pd.DataFrame()
        
    response = {
        "zscores": zscores.to_dict(orient='records'),
        "baselines": baselines.to_dict(orient='records')
    }
    return jsonify(response)

import numpy as np
from scipy.optimize import linear_sum_assignment

def align_clusters(old_df, new_df):
    """
    Renames new_df['Cluster'] labels to match old_df['Cluster'] labels
    based on the highest node overlap.
    """
    old_clusters = sorted(old_df['Cluster'].unique())
    new_clusters = sorted(new_df['Cluster'].unique())
    
    cost_matrix = np.zeros((len(old_clusters), len(new_clusters)))
    
    for i, old_c in enumerate(old_clusters):
        nodes_old = set(old_df[old_df['Cluster'] == old_c]['nodeId'])
        for j, new_c in enumerate(new_clusters):
            nodes_new = set(new_df[new_df['Cluster'] == new_c]['nodeId'])
            # Cost is the number of nodes NOT in common
            intersection = len(nodes_old.intersection(nodes_new))
            cost_matrix[i, j] = -intersection

    # Hungarian Algorithm to find best mapping
    row_ind, col_ind = linear_sum_assignment(cost_matrix)
    mapping = {new_clusters[col]: old_clusters[row] for row, col in zip(row_ind, col_ind)}
    new_df['Cluster'] = new_df['Cluster'].map(mapping)
    return new_df

def compute_dr_data(n_neighbors, min_dist, num_clusters):
    global ts_data
    df = get_dr_time(ts_data, int(n_neighbors), float(min_dist), int(num_clusters), 1)

    if os.path.exists(CLUSTER_CACHE_NAME):
        df_old = pd.read_parquet(CLUSTER_CACHE_NAME)
        df_new = align_clusters(df_old, df)
    else:
        df_new = df

    fc_start = timer()
    agg_feat_contrib_mat, label_to_rows, label_to_rep_row, order_col = get_feat_contributions(df_new)
    fc_end = timer()
    print(f'ccpca in {(fc_end - fc_start)}s')

    return {
        "dr_features": df_new.to_dict(orient='records'),
        "feat_contributions": {
            "agg_feat_contrib_mat": agg_feat_contrib_mat.tolist(),
            "label_to_rows": [list(rows) for rows in label_to_rows],
            "label_to_rep_row": label_to_rep_row,
            "order_col": order_col
        },
    }

def compute_mrdmd(nodes, selectedCols, recompute_base):
    global ts_data
    colsList = [col.replace('%', ' ') for col in selectedCols.split(',') if col.strip()]
    nodeList = list(set(nodes.split(',')))
    avail_cols = ['timestamp', 'nodeId'] + [c for c in colsList if c in ts_data.columns]
    
    filtered_data = ts_data[ts_data['nodeId'].isin(nodeList)]
    
    if not filtered_data.empty:
        zscores, baselines = get_mrdmd(filtered_data[avail_cols], int(recompute_base))
    else:
        zscores, baselines = pd.DataFrame(), pd.DataFrame()

    return {
        "zscores": zscores.to_dict(orient='records'),
        "baselines": baselines.to_dict(orient='records')
    }

@app.route('/nodeData/<selectedCols>/<file>', methods=['GET'])
def get_node_data(selectedCols, file):
    global ts_data

    if ts_data is None or ts_data.empty:
        ts_data = get_timeseries_data(file)
    
    colsList = list([col.replace('%', ' ') for col in selectedCols.split(',') if col.strip()] )
    cols = ['timestamp', 'nodeId'] + colsList
    df = ts_data[cols].copy()
    
    excluded = ['nodeId', 'timestamp', 'Retrans', 'PCA', 'UMAP', 't-SNE', 'Cluster']
    all_features = [col for col in ts_data.columns if not any(exclude in col for exclude in excluded)]
    
    check_cols = [col for col in df.columns if col not in ['nodeId', 'timestamp']]
    df['downtime'] = (df[check_cols] == 0).all(axis=1).astype(int)

    return jsonify({
        "data": df.to_dict(orient='records'),
        "features": all_features
    })

@app.route('/ingest_stream/<selectedCols>/<nodeList>/<n_neighbors>/<min_dist>/<num_clusters>', methods=['POST'])
def ingest_stream(selectedCols, nodeList, n_neighbors, min_dist, num_clusters):
    global ts_data, streaming_state
    
    batch_dir = os.path.join(filepath, 'batch')
    idx = streaming_state["next_batch_idx"]
    filename = f"batch_{idx:03d}.csv"
    file_path = os.path.join(batch_dir, filename)

    if not os.path.exists(file_path):
        return jsonify({"status": "exhausted", "message": "No more batch files found."}), 404

    try:
        # loading the new batch
        new_batch = pd.read_csv(file_path).fillna(0.0)
        if 'time_secs' in new_batch.columns:
            new_batch['timestamp'] = new_batch['time_secs']
        if 'cname_processed' in new_batch.columns:
            new_batch['nodeId'] = new_batch['cname_processed']

        # updating global data
        ts_data = pd.concat([ts_data, new_batch], ignore_index=True)
        ts_data = ts_data.drop_duplicates(subset=['timestamp', 'nodeId'], keep='last')
        print("Updated ts_data shape:", ts_data.shape)

        colsList = list([col.replace('%', ' ') for col in selectedCols.split(',') if col.strip()] )
        cols = ['timestamp', 'nodeId'] + colsList
        df = ts_data[cols].copy()
        check_cols = [col for col in df.columns if col not in ['nodeId', 'timestamp']]
        df['downtime'] = (df[check_cols] == 0).all(axis=1).astype(int)

        # recomputing pipeline
        with ThreadPoolExecutor(max_workers=2) as executor:
            future_dr = executor.submit(compute_dr_data, n_neighbors, min_dist, num_clusters)
            future_mrdmd = executor.submit(compute_mrdmd, nodeList, selectedCols, 1)

            dr_results = future_dr.result()
            mrdmd_results = future_mrdmd.result()

        streaming_state["next_batch_idx"] += 1

        return jsonify({
            "status": "success",
            "data": df.to_dict(orient='records'),
            "dr_results": dr_results,
            "mrdmd_results": mrdmd_results
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500     

if __name__ == '__main__':
    ts_data = get_timeseries_data(file)
    clear_caches()
    reset_stream()
    app.run(debug=True, port=5010)