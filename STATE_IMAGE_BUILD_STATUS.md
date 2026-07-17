# Kuromatsu state image build audit

- commit: `ce7384133bc5ea275f52349458cec1cd7d82f8e9`
- dependencies: success
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
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 16.7/16.7 MB 62.3 MB/s  0:00:00
Downloading opencv_python_headless-5.0.0.93-cp37-abi3-manylinux_2_28_x86_64.whl (61.2 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 61.2/61.2 MB 287.5 MB/s  0:00:00
Downloading pillow-12.3.0-cp312-cp312-manylinux_2_27_x86_64.manylinux_2_28_x86_64.whl (6.9 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 6.9/6.9 MB 305.0 MB/s  0:00:00
Installing collected packages: pillow, numpy, opencv-python-headless

Successfully installed numpy-2.5.1 opencv-python-headless-5.0.0.93 pillow-12.3.0
```

## Generation log
```text
Corrupt JPEG data: premature end of data segment
Traceback (most recent call last):
  File "/home/runner/work/bonsai-app/bonsai-app/scripts/build_kuromatsu_states.py", line 232, in <module>
    main()
  File "/home/runner/work/bonsai-app/bonsai-app/scripts/build_kuromatsu_states.py", line 204, in main
    base = decode_base_photo()
           ^^^^^^^^^^^^^^^^^^^
  File "/home/runner/work/bonsai-app/bonsai-app/scripts/build_kuromatsu_states.py", line 30, in decode_base_photo
    raise RuntimeError("failed to decode pine image")
RuntimeError: failed to decode pine image
```

## Validation log
```text
```
