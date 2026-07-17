# Kuromatsu state image build audit

- commit: `2c30cd285c05dc4e02684ecb6a041ed2c06845f8`
- dependencies: success
- source normalization: success
- generation: failure
- validation: skipped

## Dependency log
```text
Collecting numpy
  Downloading numpy-2.5.1-cp312-cp312-manylinux_2_27_x86_64.manylinux_2_28_x86_64.whl.metadata (6.6 kB)
Collecting opencv-python-headless
  Downloading opencv_python_headless-5.0.0.93-cp37-abi3-manylinux_2_28_x86_64.whl.metadata (19 kB)
Collecting pillow
  Downloading pillow-12.3.0-cp312-cp312-manylinux_2_27_x86_64.manylinux_2_28_x86_64.whl.metadata (9.1 kB)
Downloading numpy-2.5.1-cp312-cp312-manylinux_2_27_x86_64.manylinux_2_28_x86_64.whl (16.7 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 16.7/16.7 MB 163.2 MB/s  0:00:00
Downloading opencv_python_headless-5.0.0.93-cp37-abi3-manylinux_2_28_x86_64.whl (61.2 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 61.2/61.2 MB 357.4 MB/s  0:00:00
Downloading pillow-12.3.0-cp312-cp312-manylinux_2_27_x86_64.manylinux_2_28_x86_64.whl (6.9 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 6.9/6.9 MB 302.2 MB/s  0:00:00
Installing collected packages: pillow, numpy, opencv-python-headless

Successfully installed numpy-2.5.1 opencv-python-headless-5.0.0.93 pillow-12.3.0
```

## Normalization log
```text
normalized pine image: 320x400, 1276 bytes
```

## Generation log
```text
Traceback (most recent call last):
  File "/home/runner/work/bonsai-app/bonsai-app/scripts/build_kuromatsu_states.py", line 232, in <module>
    main()
  File "/home/runner/work/bonsai-app/bonsai-app/scripts/build_kuromatsu_states.py", line 209, in main
    fine_thin(base, mask, 0.08, 11),
    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/home/runner/work/bonsai-app/bonsai-app/scripts/build_kuromatsu_states.py", line 60, in fine_thin
    threshold = np.quantile(values, fraction)
                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/opt/hostedtoolcache/Python/3.12.13/x64/lib/python3.12/site-packages/numpy/lib/_function_base_impl.py", line 4508, in quantile
    return _quantile_unchecked(
           ^^^^^^^^^^^^^^^^^^^^
  File "/opt/hostedtoolcache/Python/3.12.13/x64/lib/python3.12/site-packages/numpy/lib/_function_base_impl.py", line 4522, in _quantile_unchecked
    return _ureduce(a,
           ^^^^^^^^^^^
  File "/opt/hostedtoolcache/Python/3.12.13/x64/lib/python3.12/site-packages/numpy/lib/_function_base_impl.py", line 3892, in _ureduce
    r = func(a, **kwargs)
        ^^^^^^^^^^^^^^^^^
  File "/opt/hostedtoolcache/Python/3.12.13/x64/lib/python3.12/site-packages/numpy/lib/_function_base_impl.py", line 4681, in _quantile_ureduce_func
    result = _quantile(arr,
             ^^^^^^^^^^^^^^
  File "/opt/hostedtoolcache/Python/3.12.13/x64/lib/python3.12/site-packages/numpy/lib/_function_base_impl.py", line 4805, in _quantile
    slices_having_nans = np.isnan(arr[-1, ...])
                                  ~~~^^^^^^^^^
IndexError: index -1 is out of bounds for axis 0 with size 0
```

## Validation log
```text
```
