import os
from concurrent.futures import ThreadPoolExecutor
from timeit import default_timer as timer
import time
import numpy as np
import pandas as pd
import sys
sys.path.append("./scripts/src/")
from mrdmd_zscore import MrDMDZscore

ml = 9
step = 10000
std_baselines_dict = {}
CACHE_DIR = './cache'
ZSC_B_CACHE_NAME = './cache/mrDMDbaselineZscores.parquet'
ZSC_CACHE_NAME = './cache/mrDMDbaselineData.parquet'

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
    return None, None

def process_columns_baseline(df):
    Z_final = []
    std_baselines_dict = {}

    def process_single_column(col):
        # computing upper and lower baseline value range
        bmin, bmax = compute_value_range(df[col])

        if bmin == 0 and bmax == 0:
            return 

        df_col = df.pivot(index="nodeId", columns="timestamp", values=col) \
                    .apply(pd.to_numeric, errors='coerce') \
                    .ffill(axis='rows') \
                    .bfill(axis='rows')
        
        # computing start and end of baseline and filter
        sob, eob = find_time_range(df_col, bmin, bmax)
            
        if sob is not None and eob is not None:
            df_col.columns = pd.to_datetime(df_col.columns)
            sob = pd.to_datetime(sob)
            eob = pd.to_datetime(eob)
            df_col = df_col.loc[:, (df_col.columns >= sob) & (df_col.columns <= eob)]
                
        else: 
            return 

        # TODO: save df_col (baselines) 

        # extracting input, output matrices
        D = df_col.iloc[:,:].to_numpy()

        # run mrDMD
        mrDMDZSC = MrDMDZscore()
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

        std_baselines_dict[col] = {
            "z_score": std_baselines
        }

        return std_baselines_dict

    cols_df = df.drop(columns=['nodeId', 'timestamp', 'Missed Buffers_P1', 'cpu_num'])
    with ThreadPoolExecutor(max_workers=15) as executor:
        executor.map(process_single_column, cols_df.columns)
    
    # zscores
    Z_final = pd.concat(Z_final, ignore_index=True) if Z_final else pd.DataFrame()
    # save baselines to parquet
    return Z_final


def extract_baselines(nbase_df, baselines, node_dict, col):
    # extracting baseline, duplicating across time series
    b_start = pd.to_datetime(baselines.columns[0])
    b_end = pd.to_datetime(baselines.columns[-1])
    b_diff = b_end - b_start

    t_start = nbase_df.columns[0]
    t_end = nbase_df.columns[-1]
    t_diff = t_end - t_start
    num_repeats = int(t_diff / b_diff) + 1

    base_ext = pd.concat([baselines] * num_repeats, axis=1)
    base_ext = base_ext.iloc[:, :len(nbase_df.columns)]
    base_ext.columns = nbase_df.columns

    D = nbase_df.to_numpy()
    return base_ext


def compute_zscores(df, baselines):
    Z_final = []

    # TODO: read std_baselines
    
    def process_single_feature(col):
        # non-baselines
        nbase_df = preprocess(df, col)
        nodelist = nbase_df.index.tolist()

        base_ext = extract_baselines(nbase_df, baselines, col)
        D = nbase_df.to_numpy()
        D = np.vstack([D,base_ext])

        mrDMDZSC = MrDMDZscore()
        nodes1 = mrDMDZSC.mrdmd(D, max_levels=ml, max_cycles=1, do_parallel=True)

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
        Z_final.append(pd.DataFrame({"nodeId": nodelist, col: values}))

    cols_df = df.drop(columns=['nodeId', 'timestamp', 'Missed Buffers_P1', 'cpu_num'])
    with ThreadPoolExecutor(max_workers=15) as executor:
        executor.map(process_single_feature, cols_df.columns)

    Z_final = pd.concat(Z_final, ignore_index=True) if Z_final else pd.DataFrame()
    return Z_final

def get_cached_or_compute_baselines(df, force_recompute=False):
    if os.path.exists(ZSC_B_CACHE_NAME) and not force_recompute:
        print('Reading cached baseline zscores from parquet')
        return pd.read_parquet(ZSC_B_CACHE_NAME)

    if force_recompute:
        print('Forcing fresh compute of baseline')
    
    ZSC_d = process_columns_baseline(df)
    os.makedirs(CACHE_DIR, exist_ok=True)
    ZSC_d.to_parquet(ZSC_B_CACHE_NAME)
    print(f'Cached baseline results to parquet {ZSC_B_CACHE_NAME}.')

    return ZSC_d

def get_mrdmd(df):
    # Step 1: Compute z-scores for baselines or get them from cache
    bs_start = timer()
    Z_b = get_cached_or_compute_baselines(df)
    bs_end = timer()

    # Step 2: Compute z-scores for the node selection compared to baseline z-scores
    mr_dmdstart = timer()
    zsc_d = compute_zscores(df, Z_b)
    mr_dmdend = timer()

    print(f'baseline in {(bs_end - bs_start)}s')
    print(f'mrDMD in {(mr_dmdend - mr_dmdstart)}s')
    return zsc_d