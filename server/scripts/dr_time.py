"""2-stage dimension reduction across time domain then feature domain"""

from timeit import default_timer as timer

import numpy as np
import pandas as pd
from sklearn.decomposition import PCA
from sklearn.manifold import TSNE
from sklearn.preprocessing import StandardScaler
from concurrent.futures import ThreadPoolExecutor
from umap import UMAP

# TODO: finish docstrings

def getData():
    # TODO: cache this on server startup - shared by dr_features and dr_time
    df = pd.read_csv('./data/farm/far_data_2024-02-21.csv').fillna(0.0)
    return df

def preprocess(df, value_column):
    return df.loc[:, ['timestamp', 'nodeId', value_column]] \
             .pivot_table(index='timestamp', columns='nodeId', values=value_column) \
             .apply(lambda row: row.fillna(0.0), axis=0).T

def apply_first_dr(df, col_name, method='PCA', var_threshold=0.7, explained_variance_dict=None):
    try:
        # pivot: rows -> timestamps, columns -> nodeId
        X = preprocess(df, col_name)

        X.columns = pd.to_datetime(X.columns)

        start_index = int(len(X.columns) * 0.3)
        end_index = int(len(X.columns) * 0.45)
        X_filtered = X.iloc[:, start_index:end_index]

        # convert to cupy array
        # baseline = cp.array(X.values)
        baseline = X_filtered.values

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
                P_fin = pd.DataFrame({"DR1": scores[:, 0]})
                P_fin['Measurement'] = X.index
                P_fin['Explained Variance'] = explained_variance
                if explained_variance_dict is not None:
                    explained_variance_dict[col_name] = explained_variance
            else:
                return None      
            
            fc_t_df = pd.DataFrame()

            # print(f"{col_name} done...")

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
    
def get_numeric_columns(df):
    return df.drop(columns=['timestamp', 'nodeId']).columns

def process_single_column(df, col_name, P_final, FC_final):
    try:
        result = apply_first_dr(df, col_name, 'PCA', 0.7, explained_variance_dict)

        if result is None:
            return 
        
        P_df, fc_t_df, explained_variance_dict = result

        if P_df is not None:
            P_df.insert(0, 'Col', col_name)
            P_final.append(P_df)

        if fc_t_df is not None:
            FC_final.append(fc_t_df)

    except Exception as e:
        print(f"Error processing {col_name}: {e}")
        return None, explained_variance_dict

def process_columns(df):
    P_final = []
    FC_final = []
    explained_variance_dict = {}

    numeric_cols = get_numeric_columns(df)

    with ThreadPoolExecutor() as executor:
        # Submit tasks and collect futures
        futures = {executor.submit(process_single_column, df, col, P_final, FC_final): col for col in numeric_cols}

        for future in futures:
            P_df, fc_t_df, explained_variance = future.result()

            if P_df is not None:
                P_final.append(P_df)

            if fc_t_df is not None:
                FC_final.append(fc_t_df)

            if explained_variance is not None:
                explained_variance_dict.update(explained_variance)

    P_final = pd.concat(P_final, ignore_index=True) if P_final else pd.DataFrame()
    FC_final = pd.concat(FC_final, ignore_index=True) if FC_final else pd.DataFrame()

    return P_final, FC_final, explained_variance_dict


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

def apply_tsne(df):
    df_tsne = df.copy(deep=True)
    tsne = TSNE(n_components=2, random_state=42)
    embedding = tsne.fit_transform(df_tsne)
    return embedding[:, 0], embedding[:, 1] # columns 'tSNE1', 'tSNE2'

def get_dr_time(df, components_only=False):
    # First pass DR across Timestamps
    dr1start = timer()
    D_final, FC_final, explained_variance_dict = process_columns(df)
    dr1end = timer()

    # Second pass DR across Features
    # PCA then tSNE and UMAP
    dr2start = timer()
    results = apply_second_dr(D_final)
    dr2end = timer()

    print(f'DR1 in {(dr1end - dr1start)}s')
    print(f'DR2 in {(dr2end - dr2start)}s')
    
    explained_variance_df = pd.DataFrame(list(explained_variance_dict.items()), columns=["Column", "Explained Variance"])
    explained_variance_df.to_csv('../data/farm/explained_variance.csv', index=False)
    
    return results[['PC1', 'PC2', 'UMAP1', 'UMAP2', 'tSNE1', 'tSNE2']] if components_only else results