import { Module } from "@nestjs/common";
import { HelloController } from "./hello.controller";
import { HelloService } from "./hello.service";

@Module({
    controllers: [HelloController],//声明这个模块有一个控制器HelloController
    providers: [HelloService]//声明这个模块有一个提供者（服务）
})
export class HelloModule{}//导出这个模块，供其他模块使用