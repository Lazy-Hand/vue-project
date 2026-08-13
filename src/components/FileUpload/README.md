# FileUpload

`FileUpload` 是文件管理页面可复用的拖放上传组件。它把选择、校验、普通上传和大文件分片上传收敛到一个紧凑的“文件货架”队列中。

## 用法

```vue
<script setup lang="ts">
import { ref } from 'vue'
import FileUpload, { type FileUploadExpose } from '@/components/FileUpload/index.vue'
import type { UploadResponse } from '@/types/file'

const uploader = ref<FileUploadExpose>()

function handleSuccess(response: UploadResponse, file: File): void {
  console.log('uploaded', response, file.name)
}
</script>

<template>
  <FileUpload
    ref="uploader"
    category="VIDEO"
    :multiple="true"
    :max-count="3"
    business-type="asset"
    business-id="asset-001"
    @success="handleSuccess"
  />
</template>
```

`autoUpload` 默认为 `true`。设为 `false` 时，选择完成后通过 `ref` 调用 `upload()`：

```ts
await uploader.value?.upload()
const uploaded = uploader.value?.getUploadedFiles() ?? []
uploader.value?.clear()
```

## Props

| Prop                          | 类型                              | 默认值     | 说明                     |
| ----------------------------- | --------------------------------- | ---------- | ------------------------ |
| `category`                    | `FILE \| IMAGE \| AUDIO \| VIDEO` | `FILE`     | 校验规则和接口路由       |
| `multiple`                    | `boolean`                         | `false`    | 是否允许一次选择多个文件 |
| `maxCount`                    | `number`                          | `1`        | 队列最大文件数           |
| `businessType` / `businessId` | `string`                          | —          | 业务上下文，必须同时传入 |
| `disabled`                    | `boolean`                         | `false`    | 禁止选择及操作           |
| `accept`                      | `string`                          | 按分类生成 | 自定义浏览器选择器过滤器 |
| `autoUpload`                  | `boolean`                         | `true`     | 选择后是否自动开始上传   |

## 分类限制

| 分类    | 类型                    | 单文件上限 | 自动分片阈值 |
| ------- | ----------------------- | ---------: | -----------: |
| `FILE`  | PDF                     |      5 GiB |     > 20 MiB |
| `IMAGE` | PNG / JPEG / GIF / WebP |     10 MiB |            — |
| `AUDIO` | MP3 / WAV / OGG         |     50 MiB |            — |
| `VIDEO` | MP4 / MOV / WebM        |      5 GiB |    > 200 MiB |

PDF 和视频达到阈值后，会从接口返回的 `partSize` 读取分片大小（缺省 10 MiB），按顺序计算 SHA-256、上传每片并完成会话。队列进度是所有分片的总进度。

## Events

- `success(response, file)`：文件上传完成。
- `error(error, file)`：校验、请求或分片失败；失败条目可点击重试。
- `change(responses)`：当前已完成文件的响应列表变化。

上传中的条目可取消。普通上传调用请求的 `abort`，分片上传还会调用 `abortMultipartUpload`；取消后可以点击重试。

## Expose

- `upload(): Promise<void>`：按队列顺序上传待处理条目。
- `clear(): void`：取消活动请求并清空队列。
- `getUploadedFiles(): UploadResponse[]`：获取当前已完成文件的响应列表副本。
