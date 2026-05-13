import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Post, Query, Res, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common'
import { FilesInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { randomUUID } from 'crypto'
import { extname, relative, resolve } from 'path'
import { mkdirSync } from 'fs'
import { realpath } from 'fs/promises'
import { AuthGuard } from '../common/auth.guard'
import { CurrentUser } from '../common/current-user.decorator'
import { Roles } from '../common/roles.decorator'
import { RolesGuard } from '../common/roles.guard'
import { CreateProjectDto, ReviewRerunRequestDto } from './projects.dto'
import { ProjectsService } from './projects.service'

const uploadDir = resolve(process.env.UPLOAD_DIR || resolve(process.cwd(), 'uploads/rerun-requests'))
mkdirSync(uploadDir, { recursive: true })

// 二次抽取材料按现场要求只接收 PDF，保存到后端本地上传目录。
const allowedExtensions = new Set(['.pdf'])

async function resolveUploadFilePath(filePath: string) {
  const [uploadRoot, targetPath] = await Promise.all([realpath(uploadDir), realpath(filePath)])
  const relativePath = relative(uploadRoot, targetPath)
  if (relativePath.startsWith('..') || resolve(uploadRoot, relativePath) !== targetPath) {
    throw new BadRequestException('材料文件路径非法')
  }
  return targetPath
}

@Controller()
@UseGuards(AuthGuard, RolesGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post('projects')
  create(@CurrentUser() user: any, @Body() dto: CreateProjectDto) {
    // 项目提交入口：后端会立即创建项目并执行轮候抽取。
    return this.projectsService.create(user, dto)
  }

  @Get('projects')
  @Roles('admin', 'super_admin')
  list(
    @Query('keyword') keyword?: string,
    @Query('secret_level') secretLevel?: string,
    @Query('status') status?: string
  ) {
    // 管理端项目列表入口：按查询条件筛选全部项目记录。
    return this.projectsService.list({ keyword, secret_level: secretLevel, status })
  }

  @Get('projects/mine')
  mine(@CurrentUser() user: any) {
    // 用户端项目列表入口：只返回当前登录人的项目。
    return this.projectsService.mine(user)
  }

  @Get('projects/:id')
  get(@CurrentUser() user: any, @Param('id', ParseIntPipe) id: number) {
    // 项目详情入口：service 层会继续校验普通用户的数据归属。
    return this.projectsService.get(user, id)
  }

  @Post('projects/:id/rerun-requests')
  @Roles('user')
  @UseInterceptors(
    FilesInterceptor('files', 5, {
      storage: diskStorage({
        destination: uploadDir,
        filename: (_req, file, cb) => {
          // 文件名使用时间戳和随机数，避免覆盖同名验收材料。
          const suffix = `${Date.now()}-${randomUUID()}${extname(file.originalname).toLowerCase()}`
          cb(null, suffix)
        }
      }),
      limits: { fileSize: 20 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const extension = extname(file.originalname).toLowerCase()
        cb(null, allowedExtensions.has(extension))
      }
    })
  )
  submitRerunRequest(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() files: any[],
    @Body('reason') reason?: string
  ) {
    // 上传验收材料入口：上传成功后材料即可用于二次抽取。
    return this.projectsService.submitRerunRequest(user, id, files, reason)
  }

  @Post('projects/:id/rerun')
  @Roles('user')
  rerun(@CurrentUser() user: any, @Param('id', ParseIntPipe) id: number) {
    // 二次抽取入口：必须已有可用验收材料，且会排除历史中选供应商。
    return this.projectsService.rerun(user, id)
  }

  @Get('rerun-requests')
  @Roles('super_admin')
  rerunRequests() {
    // 兼容旧审批流程的申请列表，目前上传材料默认进入 uploaded 状态。
    return this.projectsService.listRerunRequests()
  }

  @Post('rerun-requests/:id/review')
  @Roles('super_admin')
  reviewRerunRequest(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewRerunRequestDto
  ) {
    // 兼容旧审批流程的审核入口，只处理 pending 状态申请。
    return this.projectsService.reviewRerunRequest(user, id, dto)
  }

  @Get('rerun-requests/:id/files/:fileId')
  async downloadRerunFile(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
    @Param('fileId', ParseIntPipe) fileId: number,
    @Res() res: any
  ) {
    // 验收材料下载入口：先做业务鉴权，再交给 Express 下载文件。
    const file = await this.projectsService.getRerunAttachment(user, id, fileId)
    return res.download(await resolveUploadFilePath(file.filePath), file.originalName)
  }

  @Get('lottery-records')
  @Roles('admin', 'super_admin')
  records() {
    // 抽取记录入口：用于管理端追溯全局轮候指针变化。
    return this.projectsService.records()
  }
}
