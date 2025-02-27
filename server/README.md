# Setting up Flask server

This was tested with Python version 3.13.0. If you have [pyenv](https://github.com/pyenv/pyenv) it should automatically switch to this version upon seeing the file `.python-version`.

## Set up venv

From this directory (`/server`), run

```bash
python -m venv .venv
source ./.venv/bin/activate
```

`(venv)` should now appear as a prefix to your command prompt. You will need to run the `source` command every time you use a new terminal.

## Install requirements

From this directory (`/server`), run

```bash
pip install -r requirements.txt
```

## Start server

```bash
python server.py
```

The server should now be live at `localhost:5010`.

To disable hot reloading of the server on code changes, update the last line of `server.py` as follows:

```python
app.run(debug=True, port=5010, use_reloader=False)
```

## Troubleshooting

- File not found/path errors: make sure you run the server from within `/server`.
- Module not found errors: make sure you've activated `venv` and installed dependencies. The dependencies are installed inside `server/.venv` so if it's not activated they won't be found.
