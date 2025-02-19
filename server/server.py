import os
import json
import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

data_dir = os.path.join(os.path.dirname(__file__), 'data')

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

@app.route('/drFeatureData', methods=['GET'])
def get_dr_feature_data():
    return get_csv_data('farm/multiDR_results1.csv')

@app.route('/drTimeData', methods=['GET'])
def get_dr_time_data():
    return get_csv_data('farm/multiDR_results2.csv')

@app.route('/FCTimeData', methods=['GET'])
def get_fc_t_data():
    return get_csv_data('farm/FC_t_final.csv')

@app.route('/FCFeatureData', methods=['GET'])
def get_fc_f_data():
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
    app.run(debug=True, port=5010)