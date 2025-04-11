# Cluster-Based Visual Analytics System for HPC Performance Data

## Frontend (React)

### Setup

1. `cd ui`
2. `npm install`

### Usage

1. `cd ui`
2. `npm run start`

## Backend (Flask)

### Setup

1. `cd server`
2. Ensure you're using Python 3.13. If you have `pyenv` installed, it should automatically switch Python versions when you `cd` into `server/`.
3. `python -m venv .venv`
4. `source .venv/bin/activate` (Repeat this whenever you start a new terminal)
5. `pip install -r requirements.txt`
6. Install CCPCA package
   1. Download ccpca repo as zip from <https://github.com/takanori-fujiwara/ccpca>:
   2. Download ccpca repo as zip
   3. Unzip in `/server`
   4. `cd ccpca-master`
   5. If you're on MacOS and use Homebrew, update the path to Eigen on lines 46 and 50 `/ccpca-master/ccpca/presetup.py` as follows:

      ```py
      ...
      print("building cPCA")
      os.system(
          f"c++ -O3 -Wall -mtune=native -march=native -shared -std=c++11 -undefined dynamic_lookup -I/opt/homebrew/include/eigen3/ $(python3 -m pybind11 --includes) cpca.cpp cpca_wrap.cpp -o cpca_cpp{extension_suffix}"
      )
      print("building ccPCA")
      os.system(
          f"c++ -O3 -Wall -mtune=native -march=native -shared -std=c++11 -undefined dynamic_lookup -I/opt/homebrew/include/eigen3/ $(python3 -m pybind11 --includes) cpca.cpp cpca_wrap.cpp ccpca.cpp ccpca_wrap.cpp -o ccpca_cpp{extension_suffix}"
      )
      ...
      ```

   6. Install both `ccpca/ccpca/` and `ccpca/fc_view/` as instructed in <https://github.com/takanori-fujiwara/ccpca/blob/master/README.md>

### Usage

1. `cd server`
2. `source .venv/bin/activate`
3. `python server.py`
