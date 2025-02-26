import json
import os

import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS
from scripts.dr_features import get_dr_features
from scripts.dr_time import get_dr_time

app = Flask(__name__)
CORS(app)

data_dir = os.path.join(os.path.dirname(__file__), 'data')
ts_data = pd.DataFrame()
filepath = './data/farm/'

def get_timeseries_data(file='far_data_2024-02-21.csv'):
    global ts_data
    global filepath
    ts_data = pd.read_csv(filepath+file).fillna(0.0)
    return ts_data

@app.route('/mgrData', methods=['GET'])
@app.route('/farmData', methods=['GET'])
def get_json_data():
    filename = 'mgr/novadaq-far-mgr-01-full.json'
    file_path = os.path.join(data_dir, filename)
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": "Error reading file", "details": str(e)}), 500

# PC across features
@app.route('/drFeatureData', methods=['GET'])
def get_dr_feature_data():
    global ts_data
    df = get_dr_features(ts_data)
    return jsonify(df.to_dict(orient='records'))

@app.route('/drFeatureDataCSV', methods=['GET'])
def get_dr_feature_data_from_csv():
    return get_csv_data('farm/PCA_feat_results.csv')

# PC across time points
@app.route('/drTimeData', methods=['GET'])
def get_dr_time_data():
    global ts_data
    df = get_dr_time(ts_data)
    return jsonify(df.to_dict(orient='records'))

@app.route('/drTimeDataCSV', methods=['GET'])
def get_dr_time_data_from_csv():
    return get_csv_data('farm/PCA_time_results.csv')

@app.route('/FCTimeDataCSV', methods=['GET'])
def get_fc_t_data_csv_from_csv():
    return get_csv_data('farm/FC_t_final.csv')

@app.route('/FCFeatureDataCSV', methods=['GET'])
def get_fc_f_data_from_csv():
    return get_csv_data('farm/FC_f_final.csv')

def get_csv_data(filename):
    file_path = os.path.join(data_dir, filename)
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