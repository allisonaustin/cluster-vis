"""2-stage dimension reduction across feature domain then time domain."""

from concurrent.futures import ThreadPoolExecutor
from timeit import default_timer as timer

import numpy as np
import pandas as pd
from sklearn.decomposition import PCA
from sklearn.manifold import TSNE
from sklearn.preprocessing import StandardScaler
from umap import UMAP

# TODO: finish docstrings

def getData():
    # TODO: cache this on server startup - shared by dr_features and dr_time
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

def apply_first_dr(ts, df, method='PCA', var_threshold=0.7):
    """Applying first DR method to each timestamp across features

    Args:
        df (DataFrame): Input dataframe
        ts (str): Timestamp to filter on, in format 'YYYY-MM-DD HH:MM:SS'

    Returns:
        DataFrame: dataframe with PCA1/UMAP1 of each feature
    """
    try:
        # pivot: rows -> features, columns -> nodeId
        X = preprocess(df, ts)
        baseline = X.values

        # normalizing the data (demean)
        mean_hat = baseline.mean(axis=0)
        demeaned = baseline - mean_hat

        # standardize
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(demeaned)

        if X_scaled.shape[0] < 2 or np.all(np.isnan(X_scaled)):
            return None
        
        if (method == 'PCA'):
            # apply PCA
            pca = PCA(n_components=1)
            scores = pca.fit_transform(X_scaled)

            explained_variance = pca.explained_variance_ratio_[0]

            if explained_variance >= var_threshold:
                P_fin = pd.DataFrame({"DR1": scores[:, 0]})
                P_fin['Measurement'] = X.index
                P_fin['Explained Variance'] = explained_variance
            else:
                return None
            
            abs_comp = np.abs(pca.components_[0])
            top_10 = np.argsort(abs_comp)[-10:][::-1]
            fc_f = X.columns[top_10]

            fc_f_df = pd.DataFrame({'timestamp': ts, 'feature': fc_f})

            return P_fin, fc_f_df

        elif (method == 'UMAP'):
            umap1, umap2 = apply_umap(X_scaled)

            U_fin = pd.DataFrame({"DR1": umap1})  
            U_fin['Measurement'] = X.index

            # TODO: Implement feature contribution for UMAP
            fc_t_df = pd.DataFrame()
        
            return U_fin, fc_t_df

    except Exception as e:
        print(f"Error processing {method} across {ts}: {e}")
        return None
    

def apply_second_dr(df):
    df_pivot = df.pivot(index="Measurement", columns="Col", values="DR1")
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

def process_timestamps(df):
    P_final = []
    FC_final = []

    valid_ts = get_valid_timestamps(df)
    start_idx = int(len(valid_ts) * 0.3)
    end_idx = int(len(valid_ts) * 0.45)
    timestamps = valid_ts[start_idx:end_idx]

    def process_single_timestamp(ts):
        try:
            P_df, fc_f_df = apply_first_dr(ts, df, 'PCA')

            if P_df is not None:
                P_df.insert(0, 'Col', ts)
                P_final.append(P_df)

            if fc_f_df is not None:
                FC_final.append(fc_f_df)

        except Exception as e:
            print(f'Error processing {ts}: {e}')

        return P_final, FC_final

    # TODO: parallelize
    with ThreadPoolExecutor() as executor:
        executor.map(process_single_timestamp, timestamps)
    # for ts in timestamps:
    #     process_single_timestamp(df, ts, P_final, FC_final)

    # combine all results
    P_final = pd.concat(P_final, ignore_index=True) if P_final else pd.DataFrame()
    FC_final = pd.concat(FC_final, ignore_index=True) if FC_final else pd.DataFrame()

    return P_final, FC_final

def apply_pca(df, n_components=2):
    X = df.copy(deep=True)

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
        
        P_fin = pd.DataFrame({f"PC{k+1}": scores[:, k] if k < n_components else np.nan for k in range(n_components)})
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

def apply_tsne(df):
    df_tsne = df.copy(deep=True)
    tsne = TSNE(n_components=2, random_state=42)
    embedding = tsne.fit_transform(df_tsne)
    return embedding[:, 0], embedding[:, 1] # columns 'tSNE1', 'tSNE2'

def get_dr_features(components_only=False):
    dataStart = timer()
    df = getData()
    dataEnd = timer()

    # First pass DR across Features
    dr1start = timer()
    D_final, FC_final = process_timestamps(df)
    dr1end = timer()

    # Second pass DR across Timestamps
    # PCA then tSNE and UMAP
    dr2start = timer()
    results = apply_second_dr(D_final)
    dr2end = timer()

    print(f'Read csv in {(dataEnd - dataStart)}s')
    print(f'DR1 in {(dr1end - dr1start)}s')
    print(f'DR2 in {(dr2end - dr2start)}s')
    return results[['PC1', 'PC2', 'UMAP1', 'UMAP2', 'tSNE1', 'tSNE2']] if components_only else results


def get_fc_features(df):
    P_final, FC_final = process_timestamps(df)
    return FC_final
