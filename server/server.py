import json
import os
from datetime import datetime

import pandas as pd
from flask import Flask, abort, jsonify
from flask_cors import CORS

from datetime import datetime
from timeit import default_timer as timer
from scripts.dr_time import get_dr_time
from scripts.dr_time import get_feat_contributions

from mrdmd import get_mrdmd, get_mrdmd_with_new_base
from scripts.dr_time import (get_dr_time, get_feat_contributions,
                             recompute_clusters)

app = Flask(__name__)
CORS(app)

data_dir = os.path.join(os.path.dirname(__file__), 'data')
ts_data = pd.DataFrame()
headers = pd.DataFrame()
filepath = './data/'
CACHE_DIR = './cache'
NODE_CACHE = './cache/node_data.parquet'
DR1_CACHE_NAME = './cache/drTimeDataDR1.parquet'
DR2_CACHE_NAME = './cache/drTimeDataDR2.parquet'
ZSC_B_CACHE_NAME = './cache/mrDMDbaselineZscores.parquet'

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
    print('Clearing DR/MrDMD caches on startup.')
    if os.path.exists(DR1_CACHE_NAME):
        os.remove(DR1_CACHE_NAME)
    if os.path.exists(DR2_CACHE_NAME):
        os.remove(DR2_CACHE_NAME)
    if os.path.exists(ZSC_B_CACHE_NAME):
        os.remove(ZSC_B_CACHE_NAME)

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
def get_dr_time_data(n_neighbors, min_dist, num_clusters):
    global ts_data

    df = get_dr_time(ts_data, int(n_neighbors), float(min_dist), int(num_clusters))
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

    downtime_counts = df.groupby('timestamp')['downtime'].sum().reset_index()
    downtime_counts.rename(columns={'downtime': 'num_nodes_downtime'}, inplace=True)
    df = df.merge(downtime_counts, on='timestamp', how='left')

    return jsonify({
        "data": df.to_dict(orient='records'),
        "features": all_features
    })

@app.route('/files', methods=['GET'])
def list_json_files():
    try:
        json_files = []
        for folder in os.listdir(data_dir):
            folder_path = os.path.join(data_dir, folder)
            if os.path.isdir(folder_path):
                for file in os.listdir(folder_path):
                    if file.endswith('.json'):
                        json_files.append(os.path.join(folder, file))
        return jsonify(json_files)
    except Exception as e:
        return jsonify({"error": "Error reading folder", "details": str(e)}), 500

if __name__ == '__main__':
    # ts_data = get_timeseries_data()
    clear_caches()
    app.run(debug=True, port=5010)