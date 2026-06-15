import { IsString,IsNotEmpty,MinLength,MaxLength } from "class-validator";//从class-validator库中导入一些验证装饰器，用于验证DTO类的属性
export class CreateHelloDto {
    @IsString({message: "姓名必须是一个字符串"})//验证这个属性必须是一个字符串
    @IsNotEmpty({message: "姓名不能为空"})//验证这个属性不能为空
    @MinLength(3, {message: "姓名长度不能少于3个字符"})//验证这个属性的最小长度为3·
    @MaxLength(20, {message: "姓名长度不能超过20个字符"})//验证这个属性的最大长度为20
    name: string;//定义一个name属性，类型为string

    @IsString()
    message?: string;
}//定义一个CreateHelloDto类，表示创建Hello实体时需要的数据传输对象（DTO），这个类有一个name属性，
// 并且使用了验证装饰器来确保name属性的值符合要求；如果有多个属性，可以在这个类中继`续定义，并使用相应的验证装饰器进行验证。
//message属性是验证失败时返回的错误信息，可以根据需要自定义。返回在前端时可以通过捕获验证错误来获取这些信息，并展示给用户。