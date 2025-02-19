from cuml.decomposition import PCA 
from cuml.preprocessing import StandardScaler 
import cupy as cp  
import cudf  
import pandas as pd
import numpy as np
import time
from concurrent.futures import ProcessPoolExecutor
import multiprocessing

def preprocess(df, timestamp):
    """Filter data for the given timestamp and prepare for PCA."""
    df_filtered = df[df['timestamp'] == timestamp].set_index('nodeId').drop(columns='timestamp')
    return cudf.DataFrame.from_pandas(df_filtered) 

def apply_pca_to_time(ts, df):
    """Apply PCA using cuML (GPU-accelerated)"""
    try:
        X = preprocess(df, ts) 

        baseline = X.values

        # Normalize (demean)
        mean_hat = cp.mean(baseline, axis=0)
        demeaned = baseline - mean_hat

        # Standardize using cuML's GPU scaler
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(demeaned)

        if X_scaled.shape[0] < 2 or cp.all(cp.isnan(X_scaled)):
            print(f"Skipping {ts} due to insufficient data variance.")
            return None, None

        # Apply GPU-accelerated PCA
        pca = PCA(n_components=1)
        scores = pca.fit_transform(X_scaled)

        # Get top 10 most important features
        abs_comp = cp.abs(pca.components_[0])
        top_10 = cp.argsort(abs_comp)[-10:][::-1]
        fc_f = X.columns[top_10.get()]  # Convert GPU indices to host

        # Convert results to pandas
        P_fin = pd.DataFrame({"PC1": scores.get()[:, 0]})
        P_fin["Measurement"] = X.index.to_pandas()

        fc_f_df = pd.DataFrame({'timestamp': ts, 'feature': fc_f.to_pandas()})

        return P_fin, fc_f_df

    except Exception as e:
        print(f"Error processing PCA across features for {ts}: {e}")
        return None, None

def process_ts(args):
    ts, df = args  # Unpack timestamp and dataframe
    return ts, *apply_pca_to_time(ts, df)

if __name__ == "__main__":
    start_time = time.time()

    P_final = []
    FC_final = []

    # Load data into pandas (not GPU yet)
    df_f = pd.read_csv('../data/farm/far_data_2024-02-21.csv').fillna(0.0)

    num_nodes = 195
    valid_ts = df_f.groupby('timestamp').filter(lambda x: x['nodeId'].nunique() == num_nodes)['timestamp'].unique()

    cpu_count = multiprocessing.cpu_count()

    with ProcessPoolExecutor(max_workers=cpu_count) as executor:
        results = executor.map(process_ts, [(ts, df_f) for ts in valid_ts])

    for ts, P_df, fc_f_df in results:
        if P_df is not None:
            P_df.insert(0, 'Col', ts)
            P_final.append(P_df)

        if fc_f_df is not None:
            FC_final.append(fc_f_df)

    if P_final:
        pd.concat(P_final).to_csv('P_df.csv', index=False)

    if FC_final:
        pd.concat(FC_final).to_csv('FC_final.csv', index=False)

    elapsed_time = time.time() - start_time
    print(f"Processing completed in {elapsed_time:.2f} seconds.")
