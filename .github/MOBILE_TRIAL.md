# 叠影潮（Echo Tide）｜手机横屏试玩包

这是尚未合并到主线的测试版本，仅供体验与反馈，不代表正式发布或真机验收通过。

## 运行：Windows 电脑 + 手机

1. 解压外层 GitHub Actions 工件，再解压其中的 `echo-tide-phone-trial.zip`，可以看到 `dist` 文件夹及 `BUILD_ID.txt`。
2. 让 Windows 电脑与手机连接到同一可信 Wi-Fi 网络。
3. 在包含 `dist` 文件夹的目录打开 PowerShell，运行：
   ```powershell
   py -m http.server 4173 --bind 0.0.0.0 --directory dist
   ```
   如果 `py` 不存在而安装了 Python，可改为 `python -m http.server 4173 --bind 0.0.0.0 --directory dist`。
4. 在另一个 PowerShell 中运行 `ipconfig`，找到当前 Wi-Fi 网卡的“IPv4 地址”。
5. 用手机浏览器访问 `http://<电脑的IPv4地址>:4173`（把尖括号内容换成实际地址），把手机旋转到横屏。
6. 试玩结束后，在运行服务器的窗口按 `Ctrl+C` 关闭。

电脑自己测试可访问 `http://127.0.0.1:4173`。不要直接双击 `dist/index.html`，模块资源需要通过 HTTP 服务加载。

若手机无法访问，检查两台设备是否处于同一局域网、是否启用了 Wi-Fi 客户端隔离，以及 Windows 防火墙是否阻止了 Python。在防火墙提示中仅对可信的专用网络放行；不要向公网开放端口。

## 需要人工验证的操作

- 竖屏显示旋转提示、触控按键不出现，计时暂停；旋回横屏继续当前关卡，不重新开始。
- 左手按住移动，右手同时按跳跃、冲刺或锚定；松开后不残留按键。
- 反复切换方向、锁定屏幕旋转、返回浏览器后台后恢复；确认没有误重开或卡住。
- 检查屏幕刘海、圆角、安全区是否挡住按钮；尝试三关，关注阅读大小和实际操作舒适度。

建议记录：设备型号、Android/iOS 版本、浏览器、横屏尺寸、出现问题的关卡、复现步骤和截图。电脑模拟浏览器自动测试通过，不能替代这些真机结果。

## 版本与完整性

- `BUILD_ID.txt` 是打包所用的 Git 提交标识。
- 外层工件还包含 `echo-tide-phone-trial.sha256`，可使用 `Get-FileHash .\echo-tide-phone-trial.zip -Algorithm SHA256` 校验内层 ZIP。
- 此试用包只部署到本地设备，不会自动上传数据或发布网站。
