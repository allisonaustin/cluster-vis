"""2-stage dimension reduction across feature domain then time domain."""

import numpy as np
import pandas as pd
from sklearn.decomposition import PCA
from sklearn.manifold import TSNE
from sklearn.preprocessing import StandardScaler
from umap import UMAP

# TODO: finish docstrings
# TODO: benchmark time taken per function

def getData():
    # TODO: cache this on server startup?
    df = pd.read_csv('./data/farm/far_data_2024-02-21.csv').fillna(0.0)
    return df

def preprocess(df, ts):
    """
    Args:
        df (DataFrame): Input dataframe
        ts (str): Timestamp to filter on, in format `YYYY-MM-DD HH:MM:SS`

    Returns:
        DataFrame: df filtered by timestamp, with index set to nodeId
    """
    return df[df['timestamp']==ts].set_index('nodeId').drop(columns='timestamp')

def apply_pca_to_time(df, ts):
    """Applying PCA to each timestamp across features

    Args:
        df (DataFrame): Input dataframe
        ts (str): Timestamp to filter on, in format 'YYYY-MM-DD HH:MM:SS'

    Returns:
        DataFrame: dataframe with PCA 
    """
    try:
        # pivot: rows -> features, columns -> nodeId
        X = preprocess(df, ts)

        # convert to cupy array
        # baseline = cp.array(X.values)
        baseline = X.values

        # normalizing the data (demean)
        mean_hat = baseline.mean(axis=0)
        demeaned = baseline - mean_hat

        # standardize
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(demeaned)

        # if (X_scaled.shape[0] < 2 or np.all(np.isnan(X_scaled)) or np.all(X_scaled == 0)):
        if X_scaled.shape[0] < 2 or np.all(np.isnan(X_scaled)):
            print(f"Skipping {ts} due to insufficient data variance.")
            return None

        # apply PCA
        pca = PCA(n_components=1)
        scores = pca.fit_transform(X_scaled)

        explained_variance_ratio_cumsum = np.cumsum(pca.explained_variance_ratio_)
        npc = np.sum(explained_variance_ratio_cumsum < 0.9999) + 1
        # print(f"Number of principal components: {npc}")
        # print(f"PC1:",pca.components_[1], len(pca.components_[1]))
        abs_comp = np.abs(pca.components_[0])
        top_10 = np.argsort(abs_comp)[-10:][::-1]
        # top 10 most influential features for this column
        fc_f = X.columns[top_10]

        P_fin = pd.DataFrame({f"PC{k+1}": scores[:, k] if k < npc else np.nan for k in range(1)})
        P_fin['Measurement'] = X.index

        fc_f_df = pd.DataFrame({'timestamp': ts, 'feature': fc_f})

        # print(f"{col_name} done...")

        return P_fin, fc_f_df

    except Exception as e:
        print(f"Error processing PCA across features: {e}")
        return None


def get_valid_timestamps(df):
    """Get list of timestamps where readings exist for all 195 nodes

    Args:
        df (DataFrame): Dataframe of measurements including `timestamp` and `nodeId` columns

    Returns:
        numpy.ndarray: 1d array of timestamps
    """
    num_nodes = 195
    valid_ts = valid_ts = df.groupby('timestamp').filter(lambda x: x['nodeId'].nunique() == num_nodes)['timestamp'].unique()
    print('valid timestamps:', len(valid_ts))
    return valid_ts

def process_single_timestamp(df, ts, P_final, FC_final):
    try:
        P_df, fc_f_df = apply_pca_to_time(df, ts)

        if P_df is not None:
            P_df.insert(0, 'Col', ts)
            P_final.append(P_df)

        if fc_f_df is not None:
            FC_final.append(fc_f_df)

    except Exception as e:
        print(f'Error processing {ts}: {e}')

    return P_final, FC_final

def process_timestamps(df):
    P_final = []
    FC_final = []

    valid_ts = get_valid_timestamps(df)
    start_idx = int(len(valid_ts) * 0.3)
    end_idx = int(len(valid_ts) * 0.45)
    timestamps = valid_ts[start_idx:end_idx]

    # TODO: parallelize
    for ts in timestamps:
        process_single_timestamp(df, ts, P_final, FC_final)

    # combine all results
    P_final = pd.concat(P_final, ignore_index=True) if P_final else pd.DataFrame()
    FC_final = pd.concat(FC_final, ignore_index=True) if FC_final else pd.DataFrame()

    return P_final, FC_final

def process_features(df):
    df_pivot = df.pivot(index="Measurement", columns="Col", values="PC1")
    df_pca = apply_pca(df_pivot)
    print(df_pca.columns)
    umap1, umap2 = apply_umap(df_pivot)
    tsne1, tsne2 = apply_tsne(df_pivot)

    # return df_pca['PC1']
    # append DR results to df
    return df_pivot.assign(PC1=df_pca['PC1'],
                    PC2=df_pca['PC2'],
                    UMAP1=umap1,
                    UMAP2=umap2,
                    tSNE1=tsne1,
                    tSNE2=tsne2)

def apply_pca(df):
    X = df.copy(deep=True)
    n_components = 2

    try:
        baseline = X.values

        # normalizing the data (demean)
        mean_hat = baseline.mean(axis=0)
        demeaned = baseline - mean_hat

        # standardize
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(demeaned)

        # apply PCA
        pca = PCA(n_components=n_components)
        scores = pca.fit_transform(X_scaled)

        explained_variance_ratio_cumsum = np.cumsum(pca.explained_variance_ratio_)
        npc = np.sum(explained_variance_ratio_cumsum < 0.9999) + 1
        n_components = scores.shape[1]
        print(f"Number of principal components: {n_components}")
        

        P_fin = pd.DataFrame({f"PC{k+1}": scores[:, k] if k < n_components else np.nan for k in range(3)})
        P_fin['Measurement'] = X.index
        P_fin.set_index('Measurement', inplace=True)

        return P_fin # return df with rows = node IDs, cols PC1, PC2, nodeId, measurement index

    except Exception as e:
        print(f"Error processing PCA across features: {e}")
        return None
    
def apply_umap(df):
    df_umap = df.copy(deep=True)
    umap = UMAP(n_components=2, random_state=42)
    embedding = umap.fit_transform(df_umap)
    return embedding[:, 0], embedding[:, 1] # columns 'UMAP1', 'UMAP2'
    # df_pivot['UMAP1'] = embedding[:, 0]
    # df_pivot['UMAP2'] = embedding[:, 1]
    # df_pivot['nodeId'] = df_pivot.index

def apply_tsne(df):
    df_tsne = df.copy(deep=True)
    tsne = TSNE(n_components=2, random_state=42)
    embedding = tsne.fit_transform(df_tsne)
    return embedding[:, 0], embedding[:, 1] # columns 'tSNE1', 'tSNE2'
    # df_pivot['tSNE1'] = embedding[:, 0]
    # df_pivot['tSNE2'] = embedding[:, 1]
    # df_pivot['nodeId'] = df_pivot.index

def get_dr_features():
    df = getData()

    # First pass DR across Features
    P_final, FC_final = process_timestamps(df)

    # Second pass DR across Timestamps
    # PCA then tSNE and UMAP
    return process_features(P_final)
