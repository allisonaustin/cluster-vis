import json
import os

import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS
from scripts.dr_time import get_dr_time
from scripts.dr_time import get_feat_contributions
from mrdmd import get_mrdmd

app = Flask(__name__)
CORS(app)

data_dir = os.path.join(os.path.dirname(__file__), 'data')
ts_data = pd.DataFrame()
filepath = './data/farm/'
CACHE_DIR = './cache'
NODE_CACHE = './cache/buffer_node_data.parquet'

def get_timeseries_data(file='far_data_2024-02-21.csv'):
    # TODO: convert to parquet instead of global
    global ts_data
    global filepath
    ts_data = pd.read_csv(filepath+file).fillna(0.0)
    return ts_data

@app.route('/mgrData', methods=['GET'])
def get_json_data():
    filename = 'mgr/novadaq-far-mgr-01-full.json'
    file_path = os.path.join(data_dir, filename)
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": "Error reading file", "details": str(e)}), 500

# PC across time points
@app.route('/drTimeData', methods=['GET'])
def get_dr_time_data():
    global ts_data
    df = get_dr_time(ts_data)
    agg_feat_contrib_mat, label_to_rows, label_to_rep_row, order_col, = get_feat_contributions(df)

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

@app.route('/mrdmd/<nodes>/<b_start>/<b_end>/<selectedCols>', methods=['GET'])
def get_mrdmd_results(nodes, b_start, b_end, selectedCols):
    global ts_data

    baseline_start = pd.to_datetime(b_start.replace('%', ' '))
    baseline_end = pd.to_datetime(b_end.replace('%', ' '))
    colsList = list([col.replace('%', ' ') for col in selectedCols.split(',') if col.strip()] )
    nodeList = list([nodes for node in nodes.split(',') if node.strip()] )
    cols = ['timestamp', 'nodeId'] + colsList

    # df = get_mrdmd(ts_data[cols])

    df = pd.DataFrame()

    response = {
        "zscores": df.to_dict(orient='records'),
        "baselines": {}
    }
    return jsonify(response)

@app.route('/nodeData/<selectedCols>', methods=['GET'])
def get_node_data(selectedCols):
    global ts_data

    if ts_data is None or ts_data.empty:
        return jsonify({"error": "No data available"}), 400
    
    colsList = list([col.replace('%', ' ') for col in selectedCols.split(',') if col.strip()] )
    cols = ['timestamp', 'nodeId'] + colsList
    df = ts_data[cols].copy()
    return jsonify(df.to_dict(orient='records'))

def get_csv_data():
    file_path = os.path.join(data_dir, 'farm/far_data_2024-02-21.csv')
    if not os.path.exists(file_path):
        return jsonify({"error": "File not found"}), 404
    
    try:
        df = pd.read_csv(file_path)
        df = df.loc[:, ~df.columns.str.contains('^Unnamed')]
        if 'timestamp' in df.columns:
            df['timestamp'] = pd.to_datetime(df['timestamp'], utc=True)
        return jsonify(df.to_dict(orient='records'))
    except Exception as e:
        return jsonify({"error": "Error reading CSV file", "details": str(e)}), 500

@app.route('/files', methods=['GET'])
def list_json_files():
    try:
        json_files = []
        for folder in os.listdir(data_dir):
            folder_path = os.path.join(data_dir, folder)
            if os.path.isdir(folder_path) and 'farm' not in folder:
                for file in os.listdir(folder_path):
                    if file.endswith('.json'):
                        json_files.append(os.path.join(folder, file))
        return jsonify(json_files)
    except Exception as e:
        return jsonify({"error": "Error reading folder", "details": str(e)}), 500

if __name__ == '__main__':
    ts_data = get_timeseries_data()
    app.run(debug=True, port=5010)