"""2-stage dimension reduction across time domain then feature domain"""
import os
from concurrent.futures import ThreadPoolExecutor
from timeit import default_timer as timer

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.manifold import TSNE
from sklearn.preprocessing import StandardScaler
from umap import UMAP
from ccpca import CCPCA 
from opt_sign_flip import OptSignFlip
from mat_reorder import MatReorder

# TODO: finish docstrings
CACHE_DIR = './cache'
DR1_CACHE_NAME = './cache/drTimeTHETADR1.parquet'

def preprocess(df, value_column):
    return df.loc[:, ['timestamp', 'nodeId', value_column]] \
             .pivot_table(index='timestamp', columns='nodeId', values=value_column) \
             .apply(lambda row: row.fillna(0.0), axis=0).T

def apply_first_dr(df, col_name, method='PCA', var_threshold=0.7, explained_variance_dict=None, clamp_time_window=False):
    try:
        # pivot: rows -> timestamps, columns -> nodeId
        X = preprocess(df, col_name)

        X.columns = pd.to_datetime(X.columns)

        start_index = int(len(X.columns) * 0.3)
        end_index = int(len(X.columns) * 0.45)
        X_filtered = X.iloc[:, start_index:end_index]

        baseline = X_filtered.values if clamp_time_window else X.values

        # normalizing the data (demean)
        mean_hat = baseline.mean(axis=0)
        demeaned = baseline - mean_hat

        # standardize
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(demeaned)

        if (X_scaled.shape[0] < 2 or np.all(np.isnan(X_scaled)) or np.all(X_scaled == 0)):
            return None

        # apply PCA
        if (method == 'PCA'):
            pca = PCA(n_components=1) # look into n_components in PCA sklearn implementation
            scores = pca.fit_transform(X_scaled)

            explained_variance = pca.explained_variance_ratio_[0]
            
            if explained_variance >= var_threshold:  # Only add PC1 if variance > some threshold
                # P_fin = pd.DataFrame({"DR1": scores[:, 0]})
                # P_fin['Measurement'] = X.index
                # P_fin['Explained Variance'] = explained_variance
                if explained_variance_dict is not None:
                    explained_variance_dict[col_name] = explained_variance
            
            P_fin = pd.DataFrame({"DR1": scores[:, 0]})
            P_fin['Measurement'] = X.index
            P_fin['Explained Variance'] = explained_variance

            abs_comp = np.abs(pca.components_[0])
            top_10 = np.argsort(abs_comp)[-10:][::-1]
            fc_t = X.columns[top_10] 

            fc_t_df = pd.DataFrame({'feature': col_name, 'timestamp': fc_t})

            return P_fin, fc_t_df, explained_variance_dict
        
        elif (method == 'UMAP'):
            umap1, umap2 = apply_umap(X_scaled)

            U_fin = pd.DataFrame({"DR1": umap1})
            U_fin['Measurement'] = X.index

            # TODO: Implement timestamp contribution for UMAP
            fc_t_df = pd.DataFrame()
        
            return U_fin, fc_t_df, explained_variance_dict
    
    except Exception as e:
        print(f"Error processing {col_name}: {e}")
        return None

def get_valid_timestamps(df):
    num_nodes = 195
    valid_ts = valid_ts = df.groupby('timestamp').filter(lambda x: x['nodeId'].nunique() == num_nodes)['timestamp'].unique()
    print('valid timestamps:', len(valid_ts))
    return valid_ts

def get_numeric_columns(df):
    return df.drop(columns=['timestamp', 'nodeId']).columns

def process_columns(df, method='PCA'):
    print('Applying DR1')
    P_final = []
    FC_final = []
    e_v_dict = {}

    numeric_cols = get_numeric_columns(df)
    # timestamps = get_valid_timestamps(df)
    # df_valid_ts = df[df['timestamp'].isin(timestamps)]
    df_valid_ts = df

    def process_single_column(col_name):
        try:
            result = apply_first_dr(df_valid_ts, col_name, method, explained_variance_dict=e_v_dict)

            if result is None:
                return 
            
            r_df, r_t_df, explained_variance = result

            if r_df is not None:
                r_df.insert(0, 'Col', col_name)
                P_final.append(r_df)

            if r_t_df is not None:
                FC_final.append(r_t_df)
            
            if explained_variance is not None:
                e_v_dict.update(explained_variance)

        except Exception as e:
            print(f"Error processing {col_name}: {e}")
            return None

    if method == 'UMAP':
        for col in numeric_cols:
            process_single_column(col)
    else:
        with ThreadPoolExecutor() as executor:
            executor.map(process_single_column, numeric_cols)


    P_final = pd.concat(P_final, ignore_index=True) if P_final else pd.DataFrame()
    FC_final = pd.concat(FC_final, ignore_index=True) if FC_final else pd.DataFrame()

    return P_final, FC_final, e_v_dict

def apply_pca(df, n_components=2):
    print('Applying DR2 PCA')
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
    print('Applying DR2 UMAP')
    df_umap = df.copy(deep=True)
    dr2_start = timer()
    umap = UMAP(n_components=2, min_dist=0.5, n_neighbors=50, random_state=42)
    embedding = umap.fit_transform(df_umap)
    dr2_end = timer()
    print(f'DR2 in {(dr2_end - dr2_start)}s')
    return embedding[:, 0], embedding[:, 1] # columns 'UMAP1', 'UMAP2'

def apply_tsne(df):
    print('Applying DR2 tSNE')
    df_tsne = df.copy(deep=True)
    tsne = TSNE(n_components=2, random_state=42)
    embedding = tsne.fit_transform(df_tsne)
    return embedding[:, 0], embedding[:, 1] # columns 'tSNE1', 'tSNE2'

def apply_second_dr(df):
    print('Applying DR2')
    df_pivot = df.pivot(index="Measurement", columns="Col", values="DR1")
    # df_pca = apply_pca(df_pivot)
    umap1, umap2 = apply_umap(df_pivot)
    # tsne1, tsne2 = apply_tsne(df_pivot)

    # return df_pca['PC1']
    # append DR results to df
    return df_pivot.assign(
                    UMAP1=umap1,
                    UMAP2=umap2)

def id_clusters_w_kmeans(df_pivot):
    X = df_pivot[['UMAP1', 'UMAP2']]
    kmeans = KMeans(n_clusters=5, n_init=10)
    df_pivot['Cluster'] = kmeans.fit_predict(X)
    df_pivot['nodeId'] = df_pivot.index

def get_feat_contributions(df):
    excluded_columns = ['UMAP1',
                        'UMAP2',
                        'nodeId',
                        'Cluster']
    X = df.drop(columns=excluded_columns)
    y = np.int_(df['Cluster'])

    unique_labels = np.unique(y) # unique cluster ids
    _, n_feats = X.shape
    n_labels = len(unique_labels)
    first_cpc_mat = np.zeros((n_feats, n_labels))
    feat_contrib_mat = np.zeros((n_feats, n_labels))

    # 1. get the scaled feature contributions and first cPC for each label
    ccpca = CCPCA(n_components=1)
    for i, target_label in enumerate(unique_labels):
        ccpca.fit(
            X[y == target_label],
            X[y != target_label],
            var_thres_ratio=0.5,
            n_alphas=40,
            max_log_alpha=0.5)

        first_cpc_mat[:, i] = ccpca.get_first_component()
        feat_contrib_mat[:, i] = ccpca.get_scaled_feat_contribs()

    # 2. apply optimal sign flipping
    OptSignFlip().opt_sign_flip(first_cpc_mat, feat_contrib_mat)

    # 3. apply hierarchical clustering with optimal-leaf-ordering
    mr = MatReorder()
    mr.fit_transform(feat_contrib_mat)
    order_col = mr.order_col_.tolist()

    # 4. apply aggregation
    n_feats_shown = n_feats
    agg_feat_contrib_mat, label_to_rows, label_to_rep_row = mr.aggregate_rows(feat_contrib_mat,
                                                                            n_feats_shown,
                                                                            agg_method='abs_max')
    return agg_feat_contrib_mat, label_to_rows, label_to_rep_row, order_col

def get_cached_or_compute_dr1(df, force_recompute=False):
    if os.path.exists(DR1_CACHE_NAME) and not force_recompute:
        # Read cached DR1 results
        print('Reading cached DR1 results from parquet')
        return pd.read_parquet(DR1_CACHE_NAME)

    if force_recompute:
        print('Forcing fresh compute of DR1')
    
    DR1_d, _, _ = process_columns(df)
    os.makedirs(CACHE_DIR, exist_ok=True)
    DR1_d.to_parquet(DR1_CACHE_NAME)
    print(f'Cached DR1 results to parquet {DR1_CACHE_NAME}.')
    return DR1_d

def get_dr_time(df, components_only=False):
    # First pass DR across Timestamps
    dr1_start = timer()
    DR1_d = get_cached_or_compute_dr1(df)
    dr1_end = timer()
    print(f'DR1 in {(dr1_end - dr1_start)}s')

    # Second pass DR across Features
    DR2_d = apply_second_dr(DR1_d)
    
    # Use kMeans to get cluster IDs
    kmeansStart = timer()
    id_clusters_w_kmeans(DR2_d)
    kmeansEnd = timer()

    print(f'kMeans in {(kmeansEnd - kmeansStart)}s')
    print(f'Returning {len(DR2_d)} rows')
    
    return DR2_d[['UMAP1', 'UMAP2' 'Cluster', 'nodeId']] if components_only else DR2_d
