# record-monitor
监控录播是否结束，并转移到相应的OneDrive文件夹

# 配置步骤（仅Linux x86_64）

## 安装`node`

### 1. 下载
```
# cd /root
# wget https://nodejs.org/dist/v16.17.0/node-v16.17.0-linux-x64.tar.xz
```

### 2. 解压
```
# tar xvf node-v16.17.0-linux-x64.tar.xz
```

### 3. 将解压后的`node`放到`/opt`文件夹中，并创建一个软连接，方便以后升级node
```
# mv node-v16.17.0-linux-x64 /opt
# cd /opt
# ln -s node-v16.17.0-linux-x64 node
```

### 4. 配置
```
# ln -s /opt/node/include/node /usr/local/include
# ln -s /opt/node/bin/* /usr/local/bin
```

### 5. 检查安装是否成功
```
# node -v
```
安装成功应该会显示v16.17.0

## 安装ffmepg

### 1. 下载
```
# wget https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz
```

### 2. 解压
```
# tar xvf ffmpeg-release-amd64-static.tar.xz
```

### 3. 将解压后的`ffmpeg`放到`/opt`文件夹中，并创建一个软连接，方便以后升级ffmpeg
```
# mv ffmpeg-5.0.1-amd64-static /opt
# cd /opt
# ln -s ffmpeg-5.0.1-amd64-static ffmpeg
```

### 4. 配置
```
# ln -s /opt/ffmpeg/ffmpeg /usr/local/bin
# ln -s /opt/ffmpeg/ffprobe /usr/loca/bin
# ln -s /opt/ffmpeg/qt-faststart /usr/local/bin
```

### 5. 检查安装是否成功
```
# ffmpeg -version
```
安装成功应该会显示：
`ffmpeg version 5.0.1-static https://johnvansickle.com/ffmpeg/  Copyright (c) 2000-2022 the FFmpeg developers`

## 创建一个非root用户
```
# adduser zimu
# passwd zimu 
```
passwd 用来设置密码


## 安装rclone

### 1. 下载并直接安装
```
# curl https://rclone.org/install.sh | sudo bash
```

### 2. 按照官方文档对rclone进行配置，如果之前已经有过配置文件，则直接copy过来放到当前非root用户文件夹下
```
# su - zimu
$ cp rclone.conf ~/.config/rclone/rclone.conf
```

## 安装record-monitor

### 1. 下载源码到zimu用户
```
# su - zimu
$ wget https://github.com/sixiwanzi-live/record-monitor/archive/refs/heads/main.zip
```

### 2. 解压
```
$ unzip main.zip
```

### 3. 配置
```
$ cd record-monitor-main
$ vim config.js
```
配置文件如下
```
export default {
    web: {
        port: 5000,
        bodyLimit: 10 * 1024 * 1024
    },
    blrec: {
        limit: {
            upload: 3
        },
        whitelist: [
            {
                // 3号直播间，用于测试
                roomId: 23058,
                remoteDst: 'sp9:/test'
            }
        ]
    }
}
```
其中，`port`是你启动的端口号，`blrec.limit.upload`为上传速度限制，3表示3MB/s，whitelist表示你需要上传到OneDrive的录播，`roomId`为直播间号（不能是短号）,`remoteDst`为远程OneDrive的Section地址。

### 4. 启动

4.1 直接启动（用于测试）
```
$ node index.js
```
4.2 后台启动（用于长期运行）

首先安装forever（用于后台启动node进程），先切换到root用户
```
# npm install -g forever
```
然后回到zimu用户，启动record-monitor
```
# su - zimu
$ cd record-monitor-main
$ npx forever start index.js
```
可以使用forever命令查看进程是否正常
```
$ npx forever list
```

### 5. 配置webhook
在blrec的web页面，打开“设置”，拉到最下，有一个"Webhook列表"。点击“+”，勾选全部消息，URL中写入
```
http://127.0.0.1:5000/blrec/webhook
```

### 6. 测试
对一个正在直播的直播间，执行一次“打开录制”和“关闭录制”的操作，应该能够看到record-monitor收到了相应的webhook消息，并且能够正常生成mp4并上传到指定文件夹。



