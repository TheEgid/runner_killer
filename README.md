<!-- sample_loader -->

docker buildx prune --all --force



# http://192.168.1.77/ui

# http://192.168.1.77/

# http://192.168.1.77/deployments/

# http://192.168.1.77/dashboard

# ENV NEXT_PUBLIC_BASE_PATH=/ui

<!-- SCHEDULED -->
# Использование curl с cloudflare
curl -s -o /dev/null -w "Speed: %{speed_download} bytes/sec\n" https://cloudflare.com/cdn-cgi/trace

https://n8n-seo.space/goaccess_web.html


[22:41:22] Failed to update state of flow run '203f97d9-0c76-4715-84f8-f369d6e25d25'
Traceback (most recent call last):
  File "/usr/local/lib/python3.11/site-packages/prefect/client/orchestration/_flow_runs/client.py", line 895, in set_flow_run_state
    response = await self.request(
               ^^^^^^^^^^^^^^^^^^^
  File "/usr/local/lib/python3.11/site-packages/prefect/client/orchestration/base.py", line 53, in request
    return await self._client.send(request)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/usr/local/lib/python3.11/site-packages/prefect/client/base.py", line 379, in send
    response.raise_for_status()
  File "/usr/local/lib/python3.11/site-packages/prefect/client/base.py", line 163, in raise_for_status
    raise PrefectHTTPStatusError.from_httpx_error(exc) from exc.__cause__
prefect.exceptions.PrefectHTTPStatusError: Client error '404 Not Found' for url 'http://127.0.0.1:4200/api/flow_runs/203f97d9-0c76-4715-84f8-f369d6e25d25/set_state'
Response: {'exception_message': 'Flow run with id 203f97d9-0c76-4715-84f8-f369d6e25d25 not found'}
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/404

The above exception was the direct cause of the following exception:

Traceback (most recent call last):
  File "/usr/local/lib/python3.11/site-packages/prefect/runner/runner.py", line 1396, in _propose_crashed_state
    state = await propose_state(
            ^^^^^^^^^^^^^^^^^^^^
  File "/usr/local/lib/python3.11/site-packages/prefect/utilities/engine.py", line 379, in propose_state
    response = await set_state_and_handle_waits(set_state)
               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/usr/local/lib/python3.11/site-packages/prefect/utilities/engine.py", line 366, in set_state_and_handle_waits
    response = await set_state_func()
               ^^^^^^^^^^^^^^^^^^^^^^
  File "/usr/local/lib/python3.11/site-packages/prefect/client/orchestration/_flow_runs/client.py", line 906, in set_flow_run_state
    raise ObjectNotFound(http_exc=e) from e
prefect.exceptions.ObjectNotFound: None

[22:41:22] Failed to update state of flow run '203f97d9-0c76-4715-84f8-f369d6e25d25'
Traceback (most recent call last):
  File "/usr/local/lib/python3.11/site-packages/prefect/client/orchestration/_flow_runs/client.py", line 895, in set_flow_run_state
    response = await self.request(
               ^^^^^^^^^^^^^^^^^^^
  File "/usr/local/lib/python3.11/site-packages/prefect/client/orchestration/base.py", line 53, in request
    return await self._client.send(request)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/usr/local/lib/python3.11/site-packages/prefect/client/base.py", line 379, in send
    response.raise_for_status()
  File "/usr/local/lib/python3.11/site-packages/prefect/client/base.py", line 163, in raise_for_status
    raise PrefectHTTPStatusError.from_httpx_error(exc) from exc.__cause__
prefect.exceptions.PrefectHTTPStatusError: Client error '404 Not Found' for url 'http://127.0.0.1:4200/api/flow_runs/203f97d9-0c76-4715-84f8-f369d6e25d25/set_state'
Response: {'exception_message': 'Flow run with id 203f97d9-0c76-4715-84f8-f369d6e25d25 not found'}
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/404

The above exception was the direct cause of the following exception:

Traceback (most recent call last):
  File "/usr/local/lib/python3.11/site-packages/prefect/workers/base.py", line 1459, in _propose_crashed_state
    state = await propose_state(
            ^^^^^^^^^^^^^^^^^^^^
  File "/usr/local/lib/python3.11/site-packages/prefect/utilities/engine.py", line 379, in propose_state
    response = await set_state_and_handle_waits(set_state)
               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/usr/local/lib/python3.11/site-packages/prefect/utilities/engine.py", line 366, in set_state_and_handle_waits
    response = await set_state_func()
               ^^^^^^^^^^^^^^^^^^^^^^
  File "/usr/local/lib/python3.11/site-packages/prefect/client/orchestration/_flow_runs/client.py", line 906, in set_flow_run_state
    raise ObjectNotFound(http_exc=e) from e
prefect.exceptions.ObjectNotFound: None

[22:41:22] Process for flow run 'amazing-cat' exited with status code: 1

[22:41:16] Engine execution exited with unexpected exception
Traceback (most recent call last):
  File "/usr/local/lib/python3.11/site-packages/prefect/client/orchestration/_flow_runs/client.py", line 397, in set_flow_run_state
    response = self.request(
               ^^^^^^^^^^^^^
  File "/usr/local/lib/python3.11/site-packages/prefect/client/orchestration/base.py", line 33, in request
    return self._client.send(request)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/usr/local/lib/python3.11/site-packages/prefect/client/base.py", line 622, in send
    response.raise_for_status()
  File "/usr/local/lib/python3.11/site-packages/prefect/client/base.py", line 163, in raise_for_status
    raise PrefectHTTPStatusError.from_httpx_error(exc) from exc.__cause__
prefect.exceptions.PrefectHTTPStatusError: Client error '404 Not Found' for url 'http://127.0.0.1:4200/api/flow_runs/203f97d9-0c76-4715-84f8-f369d6e25d25/set_state'
Response: {'exception_message': 'Flow run with id 203f97d9-0c76-4715-84f8-f369d6e25d25 not found'}
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/404

The above exception was the direct cause of the following exception:

Traceback (most recent call last):
  File "/usr/local/lib/python3.11/site-packages/prefect/flow_engine.py", line 1552, in run_flow
    ret_val = run_flow_sync(**kwargs)
              ^^^^^^^^^^^^^^^^^^^^^^^
  File "/usr/local/lib/python3.11/site-packages/prefect/flow_engine.py", line 1394, in run_flow_sync
    with engine.run_context():
  File "/usr/local/lib/python3.11/contextlib.py", line 158, in __exit__
    self.gen.throw(typ, value, traceback)
  File "/usr/local/lib/python3.11/site-packages/prefect/flow_engine.py", line 786, in run_context
    self.handle_exception(exc)
  File "/usr/local/lib/python3.11/site-packages/prefect/flow_engine.py", line 410, in handle_exception
    state = self.set_state(terminal_state)
            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/usr/local/lib/python3.11/site-packages/prefect/flow_engine.py", line 335, in set_state
    state = propose_state_sync(
            ^^^^^^^^^^^^^^^^^^^
  File "/usr/local/lib/python3.11/site-packages/prefect/utilities/engine.py", line 475, in propose_state_sync
    response = set_state_and_handle_waits(set_state)
               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/usr/local/lib/python3.11/site-packages/prefect/utilities/engine.py", line 461, in set_state_and_handle_waits
    response = set_state_func()
               ^^^^^^^^^^^^^^^^
  File "/usr/local/lib/python3.11/site-packages/prefect/client/orchestration/_flow_runs/client.py", line 408, in set_flow_run_state
    raise ObjectNotFound(http_exc=e) from e
prefect.exceptions.ObjectNotFound: None

[22:41:16] Finished in state Running()

[22:41:16] Encountered exception during execution: ObjectNotFound(None)
Traceback (most recent call last):
  File "/usr/local/lib/python3.11/site-packages/prefect/client/orchestration/_flow_runs/client.py", line 397, in set_flow_run_state
    response = self.request(
               ^^^^^^^^^^^^^
  File "/usr/local/lib/python3.11/site-packages/prefect/client/orchestration/base.py", line 33, in request
    return self._client.send(request)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/usr/local/lib/python3.11/site-packages/prefect/client/base.py", line 622, in send
    response.raise_for_status()
  File "/usr/local/lib/python3.11/site-packages/prefect/client/base.py", line 163, in raise_for_status
    raise PrefectHTTPStatusError.from_httpx_error(exc) from exc.__cause__
prefect.exceptions.PrefectHTTPStatusError: Client error '404 Not Found' for url 'http://127.0.0.1:4200/api/flow_runs/203f97d9-0c76-4715-84f8-f369d6e25d25/set_state'
Response: {'exception_message': 'Flow run with id 203f97d9-0c76-4715-84f8-f369d6e25d25 not found'}
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/404

The above exception was the direct cause of the following exception:

Traceback (most recent call last):
  File "/usr/local/lib/python3.11/site-packages/prefect/flow_engine.py", line 781, in run_context
    yield self
  File "/usr/local/lib/python3.11/site-packages/prefect/flow_engine.py", line 1395, in run_flow_sync
    engine.call_flow_fn()
  File "/usr/local/lib/python3.11/site-packages/prefect/flow_engine.py", line 802, in call_flow_fn
    self.handle_success(result)
  File "/usr/local/lib/python3.11/site-packages/prefect/flow_engine.py", line 384, in handle_success
    self.set_state(terminal_state)
  File "/usr/local/lib/python3.11/site-packages/prefect/flow_engine.py", line 335, in set_state
    state = propose_state_sync(
            ^^^^^^^^^^^^^^^^^^^
  File "/usr/local/lib/python3.11/site-packages/prefect/utilities/engine.py", line 475, in propose_state_sync
    response = set_state_and_handle_waits(set_state)
               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/usr/local/lib/python3.11/site-packages/prefect/utilities/engine.py", line 461, in set_state_and_handle_waits
    response = set_state_func()
               ^^^^^^^^^^^^^^^^
  File "/usr/local/lib/python3.11/site-packages/prefect/client/orchestration/_flow_runs/client.py", line 408, in set_flow_run_state
    raise ObjectNotFound(http_exc=e) from e
prefect.exceptions.ObjectNotFound: None
