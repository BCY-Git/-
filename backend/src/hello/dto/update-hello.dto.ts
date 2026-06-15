import { PartialType } from '@nestjs/mapped-types';
import { CreateHelloDto } from './create-hello.dto';

export class UpdateHelloDto extends PartialType(CreateHelloDto) {}
//定义一个UpdateHelloDto类，表示更新Hello实体时需要的数据传输对象（DTO），这个类继承自CreateHelloDto，并使用PartialType来将CreateHelloDto的所有属性变为可选的。
//这样在更新Hello实体时，可以只提供需要更新的属性，而不必提供所有属性；如果需要添加一些特定于更新操作的属性，也可以在这个类中定义。


