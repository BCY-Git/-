export class HelloEntity {
    id: number;
    name: string;
    message: string;
    createdAt: Date;

    constructor(partial: Partial<HelloEntity>) {//构造函数，接受一个Partial<HelloEntity>类型的参数，表示这个参数可以是HelloEntity类型的任意子集
        //Partial是TypeScript的一个内置类型，它将一个类型的所有属性变为可选的。也就是说，Partial<HelloEntity>表示一个对象，这个对象可以有HelloEntity类型的任意属性，但这些属性都是可选的。
        Object.assign(this, partial);//将传入的参数赋值给当前对象，assign方法会将源对象（partial）的所有可枚举属性复制到目标对象（this）上，并返回目标对象。
    }
}
