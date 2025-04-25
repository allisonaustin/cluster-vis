import os
from concurrent.futures import ThreadPoolExecutor
from timeit import default_timer as timer
import time
import numpy as np
import pandas as pd
import sys
sys.path.append("./scripts/src/")
import importlib 
import mrdmd_zscore

ml = 9
step = 10000
std_baselines_dict = {}
CACHE_DIR = './cache'
ZSC_B_CACHE_NAME = './cache/mrDMDbaselineZscoresDUNE.parquet'
ZSC_CACHE_NAME = './cache/mrDMDbaselineDataDUNE.parquet'

def preprocess(df, col):
    return df.pivot(index="nodeId", columns="timestamp", values=col) \
                .apply(pd.to_numeric, errors='coerce') \
                .ffill(axis='rows') \
                .bfill(axis='rows')

def compute_value_range(series, k=1.5, ext=0.1):
    """Finds the range capturing most of the data"""
    # computing IQR range for nonzero values
    q1, q3 = np.percentile(series, [25, 75])
    iqr = q3 - q1
    lower_bound = max(0, q1 - k * iqr)  # ensuring lower bound is not negative
    upper_bound = q3 + k * iqr
    lower = lower_bound - (lower_bound * ext)
    upper = upper_bound + (upper_bound * ext)
    return round(lower, 2), round(upper, 2)

def find_time_range(df, lower, upper):
    """
    Finds the longest contiguous time period where all nodes have nonzero values and the values are within the baseline range (lower and upper).
    Returns the first and last timestamp of this period.
    """
    longest_start, longest_end = None, None
    max_length = 0  # Initialize as integer to represent the longest valid period in terms of indices
    current_start = None

    for i in range(len(df.columns)):
        # Check if all values in the current column are within the baseline range
        valid_period = (df.iloc[:, i] >= lower) & (df.iloc[:, i] <= upper)
        
        if valid_period.all():  # If the entire column is within the range
            if current_start is None:  # Start a new valid period
                current_start = i
        else:
            if current_start is not None:
                length = i - current_start
                if length > max_length:  # Update longest period
                    max_length = length
                    longest_start, longest_end = current_start, i - 1
                current_start = None  # Reset for the next sequence

    # If the last sequence was the longest, update it
    if current_start is not None:
        length = len(df.columns) - current_start
        if length > max_length:
            longest_start, longest_end = current_start, len(df.columns) - 1

    if longest_start is not None and longest_end is not None:
        start_timestamp = df.columns[longest_start]
        end_timestamp = df.columns[longest_end]
        return start_timestamp, end_timestamp

    print("No valid period found within the baseline range.")
    return pd.to_datetime(df.columns).min(), pd.to_datetime(df.columns).max()

# Running mrdmd on a single column with configured baseline (time and value range)
def process_baseline(df, col, bmin, bmax, sob, eob):
    # TODO: save new baseline to cache
    Z_final = []
    ml = 9
    step = 10000
    df_col = df.pivot(index="nodeId", columns="timestamp", values=col) \
                .apply(pd.to_numeric, errors='coerce') \
                .ffill(axis='rows') \
                .bfill(axis='rows')
    
    if sob is not None and eob is not None:
        df_col.columns = pd.to_datetime(df_col.columns)
        sob = pd.to_datetime(sob)
        eob = pd.to_datetime(eob)
        df_col = df_col.loc[:, (df_col.columns >= sob) & (df_col.columns <= eob)]

    D = df_col.iloc[:,:].to_numpy()

    # run mrDMD
    mrDMDZSC = mrdmd_zscore.MrDMDZscore()
    nodes1 = mrDMDZSC.mrdmd(D, max_levels=ml, max_cycles=1, do_parallel=False)
    
    data = D.copy()
    data1 = data
    max_levels=ml
    splt = mrDMDZSC.get_splt(step, max_levels)
    nodes = nodes1
    baselines = []
    baseline_indx = []
    for i in range(data.shape[0]):
        t = data[i, :]
        if (min(t) >= bmin and max(t) <= bmax):
            baselines.append(t)
            baseline_indx.append(i)
    
    n_baseline_indx = [nb for nb in range(data.shape[0]) if nb not in baseline_indx]
   
   # compute z-score
    split_point = (data.shape[0] + 1) // 2
    baseline_indx = np.arange(0, split_point)
    n_baseline_indx = np.arange(split_point, data.shape[0])
    std_baselines = mrDMDZSC.compute_zscore(data1, \
                                            splt, \
                                            nodes, \
                                            baseline_indx, \
                                            n_baseline_indx, \
                                            for_baseline=True, \
                                            plot=False)

    std_baselines_df = pd.DataFrame({
        "feature": col,
        "b_start": sob,
        "b_end": eob,
        "v_min": bmin,
        "v_max": bmax,
        "z_score": std_baselines
    })
    
    Z_final.append(std_baselines_df)
    Z_final = pd.concat(Z_final, ignore_index=True)
    return Z_final

def process_columns_baseline(df):
    Z_final = []
    ml = 9
    step = 10000

    def process_single_column(col):
        # computing upper and lower baseline value range
        bmin, bmax = compute_value_range(df[col])
        if bmin == 0 and bmax == 0:
            mean = df[col].mean()
            std = df[col].std()
            bmin = 0 if (mean - std) < 0 else mean - std
            bmax = mean + std

        df_col = df.pivot(index="nodeId", columns="timestamp", values=col) \
                    .apply(pd.to_numeric, errors='coerce') \
                    .ffill(axis='rows') \
                    .bfill(axis='rows')
        
        # computing start and end of baseline and filter
        sob, eob = find_time_range(df_col, bmin, bmax)
            
        df_col.columns = pd.to_datetime(df_col.columns)
        sob = pd.to_datetime(sob)
        eob = pd.to_datetime(eob)
        df_col = df_col.loc[:, (df_col.columns >= sob) & (df_col.columns <= eob)]

        # extracting input, output matrices
        D = df_col.iloc[:,:].to_numpy()

        # run mrDMD
        mrDMDZSC = mrdmd_zscore.MrDMDZscore()
        nodes1 = mrDMDZSC.mrdmd(D, max_levels=ml, max_cycles=1, do_parallel=False)

        data = D.copy()
        data1 = data
        max_levels=ml
        splt = mrDMDZSC.get_splt(step, max_levels)
        nodes = nodes1
        baselines = []
        baseline_indx = []
        for i in range(data.shape[0]):
            t = data[i, :]
            if (min(t) >= bmin and max(t) <= bmax):
                baselines.append(t)
                baseline_indx.append(i)
        
        n_baseline_indx = [nb for nb in range(data.shape[0]) if nb not in baseline_indx]

        # compute z-score
        split_point = (data.shape[0] + 1) // 2
        baseline_indx = np.arange(0, split_point)
        n_baseline_indx = np.arange(split_point, data.shape[0])
        std_baselines = mrDMDZSC.compute_zscore(data1, \
                                                splt, \
                                                nodes, \
                                                baseline_indx, \
                                                n_baseline_indx, \
                                                for_baseline=True, \
                                                plot=False)

        if (len(std_baselines) == 0): std_baselines = [None]
        std_baselines_df = pd.DataFrame({
            "feature": col,
            "b_start": sob,
            "b_end": eob,
            "v_min": bmin,
            "v_max": bmax,
            "z_score": std_baselines
        })
        Z_final.append(std_baselines_df)

    cols_df = df.drop(columns=['nodeId', 'timestamp'])
    with ThreadPoolExecutor(max_workers=15) as executor:
        executor.map(process_single_column, cols_df.columns)
    
    Z_final = pd.concat(Z_final, ignore_index=True) if Z_final else pd.DataFrame(columns=["feature", "b_start", "b_end", "v_min", "v_max", "z_score"])
    return Z_final


def extract_baselines(df, nbase_df, baselines, col):
    if (baselines[baselines['feature'] == col].empty or (baselines[baselines['feature'] == col].z_score.values[0] is None)):
        print(f"[WARNING] No baseline found for column: {col}")
        return None 
    
    # extracting baseline, duplicating across time series
    b_start = pd.to_datetime(baselines.loc[baselines['feature'] == col, 'b_start'].values[0])
    b_end = pd.to_datetime(baselines.loc[baselines['feature'] == col, 'b_end'].values[0])
    b_diff = b_end - b_start

    t_start = pd.to_datetime(nbase_df.columns[0])
    t_end = pd.to_datetime(nbase_df.columns[-1])
    t_diff = t_end - t_start

    base_df = df[(pd.to_datetime(df['timestamp']) >= b_start) \
               & (pd.to_datetime(df['timestamp']) <= b_end)] \
                .pivot(index="nodeId", columns="timestamp", values=col) \
                .apply(pd.to_numeric, errors='coerce') \
                .ffill(axis='rows') \
                .bfill(axis='rows')

    base_ext = []
    for _ in range((len(nbase_df.columns) // base_df.shape[1]) + 2):
        base_ext.append(base_df)

    base_ext = pd.concat(base_ext,  axis=1)
    base_ext = base_ext.iloc[:, :len(nbase_df.columns)]
    base_ext.columns = nbase_df.columns

    D = nbase_df.to_numpy()
    return base_ext


def compute_zscores(df, baselines):
    Z_final = []
    ml = 9
    step = 10000
    
    def process_single_feature(col):
        # non-baselines
        nbase_df = preprocess(df, col)
        nodelist = nbase_df.index.tolist()

        if (len(baselines.columns) == 0):
             return pd.DataFrame()

        base_ext = extract_baselines(df, nbase_df, baselines[baselines['feature']==col], col)

        if (base_ext is None):
            return pd.DataFrame()
        
        D = nbase_df.to_numpy()
        D = np.vstack([D,base_ext])

        mrDMDZSC = mrdmd_zscore.MrDMDZscore()
        nodes1 = mrDMDZSC.mrdmd(D, max_levels=ml, max_cycles=1, do_parallel=False)

        # z-score analysis
        data = D.copy()
        data1 = data[:,:step]
        max_levels=ml
        splt = mrDMDZSC.get_splt(step, max_levels)
        nodes = nodes1
        n_baseline_indx = np.arange(0, data.shape[0] - base_ext.shape[0])
        baseline_indx = np.arange(len(n_baseline_indx), data.shape[0])

        std_baselines = baselines[baselines['feature'] == col].z_score.values[0]
        zsc = mrDMDZSC.compute_zscore(data1, \
                                    splt, \
                                    nodes1, \
                                    baseline_indx, \
                                    n_baseline_indx, \
                                    std_baselines, \
                                    for_baseline=False, \
                                    plot=False)
        
        values = zsc[0][:len(nodelist)]
        Z_df = pd.DataFrame({"nodeId": nodelist, col: values})
        return Z_df

    cols_df = df.drop(columns=['nodeId', 'timestamp'])
    results = []
    with ThreadPoolExecutor(max_workers=15) as executor:
        futures = [executor.submit(process_single_feature, col) for col in cols_df.columns]
        for future in futures:
            res = future.result()
            if res is not None:
                results.append(res)

    Z_final = pd.concat(results, axis=1)
    cols = Z_final.columns
    if 'nodeId' in cols:
        Z_final = Z_final.loc[:, ~Z_final.columns.duplicated()]
    return Z_final

def get_cached_or_compute_baselines(df, force_recompute):
    if os.path.exists(ZSC_B_CACHE_NAME) and force_recompute == 0:
        print('Reading cached baseline z-scores from parquet')
        ZSC_d = pd.read_parquet(ZSC_B_CACHE_NAME)
    else:
        ZSC_d = pd.DataFrame()  # Empty DataFrame if cache doesn't exist or force_recompute == 1

    # Extract existing features in the cache
    cached_features = set(ZSC_d['feature']) if not ZSC_d.empty else set()
    
    # Extract features from df
    df_features = set(df.columns) - {'nodeId', 'timestamp'}
    
    # Find missing features that need computation
    missing_features = df_features - cached_features

    if missing_features:
        print(f'Computing baselines for missing features: {missing_features}')
        missing_df = df[['nodeId', 'timestamp'] + list(missing_features)]
        new_baselines = process_columns_baseline(missing_df)
        
        # Append new baselines to cached ones
        if not new_baselines.empty:
            if not ZSC_d.empty:
                pd.concat([ZSC_d, new_baselines], ignore_index=True) 
            else:
                ZSC_d = new_baselines

        # Save updated baselines
        os.makedirs(CACHE_DIR, exist_ok=True)
        ZSC_d.to_parquet(ZSC_B_CACHE_NAME)
        print(f'Updated cached baseline results to parquet {ZSC_B_CACHE_NAME}.')
    else:
        print("All features already exist in the cached baseline.")

    return ZSC_d

def get_mrdmd(df, force_recompute):
    # Step 1: Compute z-scores for baselines or get them from cache
    bs_start = timer()
    Z_b = get_cached_or_compute_baselines(df, force_recompute)
    bs_end = timer()

    # Step 2: Compute z-scores for the node selection compared to baseline z-scores
    mr_dmdstart = timer()
    zsc_d = compute_zscores(df, Z_b)
    mr_dmdend = timer()

    print(f'baseline in {(bs_end - bs_start)}s')
    print(f'mrDMD in {(mr_dmdend - mr_dmdstart)}s')
    return zsc_d, Z_b

def get_mrdmd_with_new_base(df, col, bmin, bmax, sob, eob):
    # Step 1: compute z-score for given baseline 
    bs_start = timer()
    Z_b = process_baseline(df, col, bmin, bmax, sob, eob)
    bs_end = timer()

    # Step 2: Compute z-scores for the node selection compared to new baseline z-score
    mr_dmdstart = timer()
    zsc_d = compute_zscores(df, Z_b)
    mr_dmdend = timer()

    print(f'baseline in {(bs_end - bs_start)}s')
    print(f'mrDMD in {(mr_dmdend - mr_dmdstart)}s')
    return zsc_d, Z_b
