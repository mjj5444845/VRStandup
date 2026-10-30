# 项目文档

## 安装与运行

| 文档 | 用途 |
| --- | --- |
| [Mac 开发与运行](guides/01-Mac开发与运行.txt) | 安装依赖、启动页面、检查和停止 |
| [Mac 到 Windows 传文件](guides/02-Mac到Windows传文件.txt) | 准备源码和素材，排除本机缓存与私密资料 |
| [Windows 11 安装与运行](guides/03-Windows11安装与运行.txt) | 在实验室电脑安装、构建和运行 |
| [环境与上传规则](guides/SETUP.md) | 工具版本、文件分类及备份范围 |

## 功能检查

按显示、连接、通信、同步的顺序验证。每份说明分别标注 Mac、Windows 和头显的要求。

| 文档 | 页面 |
| --- | --- |
| [三维显示](guides/04-第一个工作-三维显示检查.txt) | `/spike` |
| [HTTPS 与头显连接](guides/05-第二个工作-HTTPS与头显连接.txt) | `/spike/xr` |
| [双端通信](guides/06-第三个工作-两个网页传消息.txt) | `/spike/network` |
| [音画同步](guides/07-第四个工作-声音与视频同步.txt) | `/spike/media` |
| [视频去背景](guides/08-第五个工作-视频去背景.txt) | `/spike/chroma` |

## 设计与研究资料

- [系统设计](design/SYSTEM_GUIDE.md)：目标架构、模块、研究流程和验收要求。
- [剧场建模参考](design/SCENE_REFERENCE.md)：参考包位置、空间尺寸、坐标差异及视觉细化顺序。
- [前测问卷](research/questionnaire-pre.md) · [后测问卷](research/questionnaire-post.md)：保留原有草稿，尚未确认最终题目。
- [技术决策](decisions/)：选择 Three.js、归档旧版等决定及其原因。

## 进度与维护

- [当前状态](project/STATUS.txt)：已完成与待验证事项的统一记录。
- [开发计划](project/ROADMAP.md)：从准备环境到完整实验的模块顺序。
- [检查记录](project/VALIDATION.md)：每项技术检查的过程、结果和限制。
- [变更记录](project/CHANGELOG.md)：按时间保存的修改历史。

## 文件存放约定

说明文件放在 `docs/`，可运行的代码放在 `app/` 和 `study/`。
确认可公开且由网页使用的素材放在 `public/study/`，并登记来源。
未经选用的模型、设计压缩包和原始媒体放在 `local_assets/`，临时检查结果放在 `output/`；两者默认不上传。
旧工程保留在 `archive/`，不与新版混放。

根目录保留 README、助手规则和运行工具必须读取的配置文件。
`node_modules/`、`.next/` 是本机生成的工具包与缓存；它们不属于源码，不需要手动整理或搬到 Windows。
尚未实现的模块不建立空目录，实际开发时再按系统设计创建。
