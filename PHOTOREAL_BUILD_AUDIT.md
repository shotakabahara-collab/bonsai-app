# BONSAI 黒松フォトリアル v3 ビルド監査

- trigger SHA: `9defa938b59393a11f10e7f7dbfb3c1e0c37f6f0`
- install: success
- EDSR model: success
- build: failure
- validation: skipped


## install log
```text
Collecting pillow
  Downloading pillow-12.3.0-cp312-cp312-manylinux_2_27_x86_64.manylinux_2_28_x86_64.whl.metadata (9.1 kB)
Collecting numpy
  Downloading numpy-2.5.1-cp312-cp312-manylinux_2_27_x86_64.manylinux_2_28_x86_64.whl.metadata (6.6 kB)
Collecting opencv-contrib-python-headless==4.11.0.86
  Downloading opencv_contrib_python_headless-4.11.0.86-cp37-abi3-manylinux_2_17_x86_64.manylinux2014_x86_64.whl.metadata (20 kB)
Downloading opencv_contrib_python_headless-4.11.0.86-cp37-abi3-manylinux_2_17_x86_64.manylinux2014_x86_64.whl (56.1 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 56.1/56.1 MB 192.9 MB/s  0:00:00
Downloading pillow-12.3.0-cp312-cp312-manylinux_2_27_x86_64.manylinux_2_28_x86_64.whl (6.9 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 6.9/6.9 MB 257.9 MB/s  0:00:00
Downloading numpy-2.5.1-cp312-cp312-manylinux_2_27_x86_64.manylinux_2_28_x86_64.whl (16.7 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 16.7/16.7 MB 294.8 MB/s  0:00:00
Installing collected packages: pillow, numpy, opencv-contrib-python-headless

Successfully installed numpy-2.5.1 opencv-contrib-python-headless-4.11.0.86 pillow-12.3.0
```

## model log
```text
  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                                 Dload  Upload   Total   Spent    Left  Speed
  0     0    0     0    0     0      0      0 --:--:-- --:--:-- --:--:--     0  0     0    0     0    0     0      0      0 --:--:-- --:--:-- --:--:--     0  0     0    0     0    0     0      0      0 --:--:--  0:00:01 --:--:--     0  0     0    0     0    0     0      0      0 --:--:--  0:00:02 --:--:--     0  0     0    0     0    0     0      0      0 --:--:--  0:00:03 --:--:--     0  0     0    0     0    0     0      0      0 --:--:--  0:00:04 --:--:--     0 66 36.7M   66 24.6M    0     0  4968k      0  0:00:07  0:00:05  0:00:02 5176k100 36.7M  100 36.7M    0     0  7374k      0  0:00:05  0:00:05 --:--:-- 9651k
```

## build log
```text
Traceback (most recent call last):
  File "/home/runner/work/bonsai-app/bonsai-app/scripts/build_photoreal_kuromatsu_v3.py", line 225, in <module>
    main()
  File "/home/runner/work/bonsai-app/bonsai-app/scripts/build_photoreal_kuromatsu_v3.py", line 173, in main
    source = read_embedded_photo()
             ^^^^^^^^^^^^^^^^^^^^^
  File "/home/runner/work/bonsai-app/bonsai-app/scripts/build_photoreal_kuromatsu_v3.py", line 40, in read_embedded_photo
    return Image.open(io.BytesIO(raw)).convert("RGB")
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/opt/hostedtoolcache/Python/3.12.13/x64/lib/python3.12/site-packages/PIL/Image.py", line 1069, in convert
    self.load()
  File "/opt/hostedtoolcache/Python/3.12.13/x64/lib/python3.12/site-packages/PIL/ImageFile.py", line 431, in load
    raise _get_oserror(err_code, encoder=False)
OSError: broken data stream when reading image file
```

## validate log
```text
```
