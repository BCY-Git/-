import { Injectable,NotFoundException} from "@nestjs/common";
import { CreateHelloDto } from "./dto/create-hello.dto";
import { UpdateHelloDto } from "./dto/update-hello.dto";
import { HelloEntity } from "./entities/hello.entity";

@Injectable()//装饰器，表示这个类是一个可注入的服务
export class HelloService {
    private greets: HelloEntity[] = [
        new HelloEntity({id:1,name:'Alice',message:'Hello, Alice!',createdAt:new Date()}),//定义一个私有属性greets，类型是HelloEntity数组，
        // 并初始化为一个包含一个HelloEntity对象的数组;用于存储Hello实体的数据，这里初始化了一个HelloEntity对象，表示一个id为1，name为Alice，message为Hello, Alice!，createdAt为当前时间的Hello实体。
    ];
    private nextId = 2;//定义一个私有属性idCounter，初始值为2，用于生成新的Hello实体的id

    findAll(): HelloEntity[] {//定义一个公共方法findAll，返回一个HelloEntity数组
        return this.greets;//返回greets数组，表示获取所有的Hello实体
    }

    findOne(id: number): HelloEntity {//定义一个公共方法findOne，接受一个number类型的参数id，返回一个HelloEntity对象
        const greet = this.greets.find(g => g.id === id);//在greets数组中查找id匹配的Hello实体，并将其赋值给greet变量
        if (!greet) {//如果没有找到匹配的Hello实体
            throw new NotFoundException(`Hello with id ${id} not found`);//抛出一个NotFoundException异常，表示没有找到对应的Hello实体
        }
        return greet;//返回找到的Hello实体
    }

    create(createHelloDto: CreateHelloDto): HelloEntity {//定义一个公共方法create，接受一个CreateHelloDto类型的参数createHelloDto，返回一个HelloEntity对象
        const newGreet = new HelloEntity({//创建一个新的HelloEntity对象，并将其赋值给newGreet变量
            id: this.nextId++,//设置id属性为当前的nextId值，并将nextId自增1，以便下次创建新的Hello实体
            name: createHelloDto.name,//设置name属性为createHelloDto中的name值
            message: createHelloDto.message || `Hello, ${createHelloDto.name}!`,//设置message属性为createHelloDto中的message值，如果message不存在，则使用默认的Hello, name!格式的消息
            createdAt: new Date(),//设置createdAt属性为当前时间
        });
        this.greets.push(newGreet);//将newGreet对象添加到greets数组中，表示将新的Hello实体保存到数据存储中
        return newGreet;//返回创建的新的Hello实体
    }
}