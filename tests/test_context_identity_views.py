"""Profile attribution and saved-view discovery: est-2ek.1.530."""
from __future__ import annotations

import asyncio
from contextlib import contextmanager
import json
import os
from pathlib import Path
import sys
import types
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lane_backend import COMPONENTS_OK, Runner, load  # noqa: E402

tool = load('engine/tool.py', 'identity_views_tool')
store = tool.store
api = load('dashboard/plugin_api.py', 'identity_views_api')

@contextmanager
def profile_env(**values):
    with mock.patch.dict(os.environ):
        for key in ('HERMES_PROFILE_NAME', 'HERMES_PROFILE'):
            os.environ.pop(key, None)
        os.environ.update(values)
        yield

@contextmanager
def no_core():
    with mock.patch.dict(sys.modules, {'hermes_cli.profiles': None}):
        yield

def publish_profile():
    result = tool.rich_present({'title': 'Count', 'summary': 'Example count',
                               'components': COMPONENTS_OK, 'data': {'n': 2}})
    assert result['ok'], result
    return store.read_card(result['card_id'])['envelope']['profile']

def test_profile_name_pin_is_persisted():
    with no_core(), profile_env(HERMES_PROFILE_NAME='  sample-seat  '):
        assert publish_profile() == 'sample-seat'

def test_legacy_pin_is_kept():
    with no_core(), profile_env(HERMES_PROFILE='legacy-seat'):
        assert publish_profile() == 'legacy-seat'

def test_active_profile_directory_is_persisted():
    parent = store.hermes_home()
    with no_core(), profile_env(HERMES_HOME=str(parent/'profiles'/'directory-seat')):
        assert publish_profile() == 'directory-seat'

def test_unidentified_custom_home_remains_null():
    with no_core(), profile_env():
        assert publish_profile() is None

def test_core_routed_identity_beats_launcher_env():
    module = types.ModuleType('hermes_cli.profiles')
    setattr(module, 'current_profile_name', lambda default=None: 'routed-seat')
    with mock.patch.dict(sys.modules, {'hermes_cli.profiles': module}), \
            profile_env(HERMES_PROFILE_NAME='launcher-seat'):
        assert publish_profile() == 'routed-seat'

def fake_core(name):
    module = types.ModuleType('hermes_cli.profiles')
    setattr(module, 'current_profile_name', lambda default=None: name)
    return mock.patch.dict(sys.modules, {'hermes_cli.profiles': module})

def test_core_sentinels_for_unidentified_home_are_null():
    # review b0b1c45 #1: the core answers 'custom'/'default' for an unnamed home; never stamp them
    for sentinel in ('custom', 'default'):
        with fake_core(sentinel), profile_env():
            assert publish_profile() is None, sentinel

def test_core_explicit_default_pin_is_kept():
    with fake_core('default'), profile_env(HERMES_PROFILE_NAME='default'):
        assert publish_profile() == 'default'

def test_real_core_unidentified_home_is_null():
    try:
        import hermes_cli.profiles  # noqa: F401
    except ImportError:
        print('  (core absent: fake-core sentinel case covers this)')
        return
    with profile_env():
        assert publish_profile() is None

def test_non_string_view_title_is_never_listed():
    # review b0b1c45 #2: a NaN title made /views raise under JSONResponse(allow_nan=False)
    folder = store.views_dir()
    folder.mkdir(parents=True, exist_ok=True)
    (folder/'nan-title.json').write_text('{"view_id": "nan-title", "title": NaN, "components": []}')
    (folder/'list-title.json').write_text(json.dumps({'view_id': 'list-title', 'title': ['x'], 'components': []}))
    views = api.views_view()
    json.dumps(views, allow_nan=False)
    assert views == {'ok': True, 'views': [{'view_id': 'list-title', 'title': None},
                                           {'view_id': 'nan-title', 'title': None}]}, views

def test_save_view_rejects_non_string_title():
    for bad in (float('nan'), 3, ['x']):
        try:
            store.save_view('bad-title', bad, COMPONENTS_OK)
        except store.StoreError:
            pass
        else:
            raise AssertionError('accepted title %r' % (bad,))
    assert not (store.views_dir()/'bad-title.json').exists()

def test_missing_view_directory_is_empty_and_read_only():
    assert not store.views_dir().exists()
    assert api.views_view() == {'ok': True, 'views': []}
    assert not store.views_dir().exists()

def test_views_list_saved_ids_titles_and_skip_unusable_files():
    store.save_view('z-last', 'Last', COMPONENTS_OK)
    store.save_view('a-first', 'First', COMPONENTS_OK)
    folder = store.views_dir()
    (folder/'bad.json').write_text('{')
    (folder/'Bad-Id.json').write_text('{}')
    (folder/'not-a-view.json').write_text(json.dumps({'components': 'bad'}))
    (folder/'wrong-id.json').write_text(json.dumps({'view_id': 'other-id', 'components': []}))
    (folder/'pending.tmp').write_text('{}')
    (folder/'linked.json').symlink_to(folder/'a-first.json')
    expected = [{'view_id': 'a-first', 'title': 'First'}, {'view_id': 'z-last', 'title': 'Last'}]
    before = {p.name: p.lstat().st_mtime_ns for p in folder.iterdir()}
    assert api.views_view() == {'ok': True, 'views': expected}
    assert before == {p.name: p.lstat().st_mtime_ns for p in folder.iterdir()}

def test_views_follow_current_home():
    store.save_view('first-home', 'First', COMPONENTS_OK)
    with profile_env(HERMES_HOME=str(store.hermes_home()/'other-home')):
        assert api.views_view() == {'ok': True, 'views': []}
        store.save_view('second-home', 'Second', COMPONENTS_OK)
        assert api.views_view()['views'] == [{'view_id': 'second-home', 'title': 'Second'}]
    assert api.views_view()['views'] == [{'view_id': 'first-home', 'title': 'First'}]

def test_views_route_when_fastapi_present():
    if api.router is None:
        print('  (fastapi absent: plain route function tested)')
        return
    assert '/views' in [r.path for r in api.router.routes]
    assert asyncio.run(api.get_views()) == {'ok': True, 'views': []}
    try:
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
    except (ImportError, RuntimeError):  # starlette raises RuntimeError when httpx is absent
        print('  (HTTP client absent: coroutine route tested)')
        return
    app = FastAPI()
    app.include_router(api.router, prefix='/api/plugins/hermes-rich-ui')
    with TestClient(app) as client:
        response = client.get('/api/plugins/hermes-rich-ui/views')
        assert response.status_code == 200
        assert response.json() == {'ok': True, 'views': []}
        store.save_view('listed-over-http', 'HTTP fixture', COMPONENTS_OK)
        assert client.get('/api/plugins/hermes-rich-ui/views').json() == {
            'ok': True, 'views': [{'view_id': 'listed-over-http', 'title': 'HTTP fixture'}]}

if __name__ == '__main__':
    runner = Runner()
    for case in (test_profile_name_pin_is_persisted, test_legacy_pin_is_kept,
                 test_active_profile_directory_is_persisted, test_unidentified_custom_home_remains_null,
                 test_core_routed_identity_beats_launcher_env, test_core_sentinels_for_unidentified_home_are_null,
                 test_core_explicit_default_pin_is_kept, test_real_core_unidentified_home_is_null,
                 test_non_string_view_title_is_never_listed, test_save_view_rejects_non_string_title,
                 test_missing_view_directory_is_empty_and_read_only,
                 test_views_list_saved_ids_titles_and_skip_unusable_files, test_views_follow_current_home,
                 test_views_route_when_fastapi_present):
        runner.run(case)
    runner.finish()
