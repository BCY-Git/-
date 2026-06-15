// import { Controller, Get ,Param,Query} from '@nestjs/common';

// @Controller('hello')
// export class HelloController {//export暴露的是一个类，类里面有一个方法hello

//   @Get()//装饰器，表示这个方法是一个GET请求的处理函数
//   hello(){
//     return 'Hello World!'//返回一个字符串
//   }

//   @Get(':name')//装饰器，表示这个方法是一个GET请求的处理函数，路径是/hello/greet
//   helloName(@Param('name') name: string){
//     return `Hello, ${name}!`;
//   }

//   @Get('greet')//装饰器，表示这个方法是一个GET请求的处理函数，路径是/hello/greet-query
//   helloNameQuery(@Query('name') name: string){
//     return {message:name? `Hello, ${name}!` : 'Hello, World!'};//返回一个对象，如果name存在就返回Hello, name!，否则返回Hello, World!
//   }
// }

import { Controller,Get,Post,Patch,Delete,Body,Param,ParseIntPipe} from '@nestjs/common';
import { CreateHelloDto } from './dto/create-hello.dto';
import { UpdateHelloDto } from './dto/update-hello.dto';
import { HelloEntity } from './entities/hello.entity';
import { HelloService } from './hello.service';

@Controller('hello')
export class HelloController {
  constructor(private readonly helloService: HelloService) {}//构造函数，注入HelloService服务
  
  @Get()//装饰器，表示这个方法是一个GET请求的处理函数，路径是/hello
  findAll(): HelloEntity[] {
    //这个方法返回一个HelloEntity类型的数组，表示获取所有的Hello实体
    return this.helloService.findAll();//调用HelloService的findAll方法来获取所有的Hello实体，并返回这些实体
  }//有return了为什么还需要：HelloEntity[]？
  // 这是为了明确这个方法的返回类型，告诉TypeScript这个方法应该返回一个HelloEntity类型的数组，
  // 这样在调用这个方法时，TypeScript就能进行类型检查，确保返回的数据符合预期的类型；
  // 如果没有指定返回类型，TypeScript会根据实际返回的数据来推断类型，但明确指定返回类型可以提高代码的可读性和维护性。

  @Get(':id')//装饰器，表示这个方法是一个GET请求的处理函数，路径是/hello/:id，其中:id是一个动态参数
  findOne(@Param('id', ParseIntPipe) id: number): HelloEntity {
    //这个方法接受一个number类型的参数id，表示从路径参数中获取的数据，并返回一个HelloEntity类型的对象
    return this.helloService.findOne(id);//调用HelloService的findOne方法来根据id获取对应的Hello实体，并返回这个实体
  }

  @Post()//装饰器，表示这个方法是一个POST请求的处理函数，路径是/hello
  create(@Body() createHelloDto: CreateHelloDto): HelloEntity {
    //这个方法接受一个CreateHelloDto类型的参数，表示从请求体中获取的数据，并返回一个HelloEntity类型的对象
    return this.helloService.create(createHelloDto);//调用HelloService的create方法来创建一个新的Hello实体，并返回这个实体
  }
}