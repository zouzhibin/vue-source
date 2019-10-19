var CompileUtil = {
  getVal(vm, expr) {
    // vm.$data 'school.name [school,name]
    return expr.split(".").reduce((data, current) => {
      return data[current];
    }, vm.$data);
  },
  // 设置值
  setValue(vm, expr, value) {
    expr.split(".").reduce((data, current, index, arr) => {
      if (index === arr.length - 1) {
        return (data[current] = value);
      }
      return data[current];
    }, vm.$data);
  },
  // node是节点 expr 是表达式 vm 是当前实例
  model(node, expr, vm) {
    let value = this.getVal(vm, expr);
    let fn = this.updater.modelUpdater;
    // 给输入框赋予value 属性 ndde.value = xxx

    // 给输入框加入一个观察者 如果稍后数据更新了会触发此方法
    // 会拿新值给输入框赋予值
    new Watcher(vm, expr, newVal => {
      fn(node, newVal);
    });
    node.addEventListener("input", e => {
      debugger;
      let value = e.target.value; // 获取用户输入的值
      this.setValue(vm, expr, value);
    });
    fn(node, value);
  },
  getConentValue(vm, expr) {
    // 遍历表达式 将内容 重新替换成一个完整的内容 返还回去
    return expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
      return this.getVal(vm, args[1]);
    });
  },
  on(node, expr, vm, eventName) {
    node.addEventListener(eventName, e => {
      vm[expr].call(vm, e);
    });
  },
  // 如果是文本的话
  text(node, expr, vm) {
    // 文本的话可能会存在这种情况 {{a}}{{b}} 连在一起的情况
    let fn = this.updater.textUpdater;
    let content = expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
      // 给表达式每{{}}都加上观察者
      new Watcher(vm, args[1], newVal => {
        fn(node, this.getConentValue(vm, expr));
      });
      // 取到表达式里面的值 例如  {{a}} =》 a
      return this.getVal(vm, args[1]);
    });
    fn(node, content);
  },
  html(node, expr, vm) {
    let value = this.getVal(vm, expr);
    let fn = this.updater["htmlUpdater"];
    // 给输入框赋予value 属性 ndde.value = xxx
    console.log("expr", value, node);
    // 给输入框加入一个观察者 如果稍后数据更新了会触发此方法
    // 会拿新值给输入框赋予值
    new Watcher(vm, expr, newVal => {
      fn(node, newVal);
    });

    fn(node, value);
  },
  updater: {
    // 把数据插入到节点中
    modelUpdater(node, value) {
      node.value = value;
    },
    textUpdater(node, value) {
      node.textContent = value;
    },
    htmlUpdater(node, value) {
      node.innerHTML = value;
    }
  }
};

// 通知更新
class Dep {
  constructor() {
    this.subs = []; // 存放所有的watcher
  }
  // 订阅
  addSub(watcher) {
    // 添加watcher
    this.subs.push(watcher);
  }
  // 发布
  notify() {
    this.subs.forEach(watcher => watcher.update());
  }
}
// 观察者模式 （发布订阅模式） 观察者 被观察者
// vm.$watch( expOrFn, callback, [options] )
// vm.$watch('scholl.name',cb)
class Watcher {
  constructor(vm, expr, cb) {
    this.vm = vm;
    this.expr = expr;
    this.cb = cb;
    //  默认先存放一个老值
    this.oldValue = this.get();
  }
  get() {
    Dep.target = this; // 先把自己放在this上
    // 得到老值
    // 取值 把这个观察者 和数据关联起来
    let value = CompileUtil.getVal(this.vm, this.expr);
    Dep.target = null; // 不取消 任何值取值都会添加watcher
    return value;
  }
  // 更新操作 数据变化后 会调用观察者的update方法
  update() {
    // 得到新的值
    let newVal = CompileUtil.getVal(this.vm, this.expr);
    if (newVal != this.oldValue) {
      this.cb(newVal);
    }
  }
}

// 实现模板编译
class Compiler {
  constructor(el, vm) {
    // 判断el属性 是不是一个元素 如果不是元素 那就获取他
    this.$el = this.isElementNode(el) ? el : document.querySelector(el);
    this.vm = vm;
    // 把当前节点中的元素 获取放到内存中
    let fragment = this.node2fragment(this.$el);

    // 把节点中的内容进行替换

    // 编译模板 用数据编译
    this.compile(fragment);

    // 把内容在塞到页面中
    this.$el.appendChild(fragment);
  }
  // 判断是否是指令
  isDirective(attrName) {
    return attrName.startsWith("v-");
  }
  // 编译节点
  compileElement(child) {
    // 获取节点上的所有属性
    let attributes = child.attributes; // 类数组
    //  [...attributes].forEach(attr=>{
    let arr = [];
    arr.slice.call(attributes).forEach(attr => {
      // v-model ='name'
      let { name, value } = attr;
      // 判断是不是指令
      if (this.isDirective(name)) {
        let [, directive] = name.split("-");
        let [directiveName, eventName] = directive.split(":");
        // 需要调用不同的指令来处理
        CompileUtil[directiveName](child, value, this.vm, eventName);
      }
    });
  }
  // 编译文本
  compileText(node) {
    // 判断当前文本节点中内容是否包含{{xxx}} {{aaa}}
    let content = node.textContent;
    if (/\{\{(.+?)\}\}/.test(content)) {
      console.log("content", content);
      CompileUtil["text"](node, content, this.vm);
    }
  }
  //用来编译内存中的dom节点
  compile(node) {
    let childNodes = node.childNodes;
    // 获取所有子节点
    let arr = [];
    // arr.slice.call(childNodes) // 把类数组转换为数组
    arr.slice.call(childNodes).forEach(element => {
      // 判断是元素节点还是文本内容
      if (this.isElementNode(element)) {
        this.compileElement(element); // 执行编译节点，获取节点上的指令
        // 因为节点中里面还包含文本，所以需递归获取文本里面的内容
        this.compile(element);
      } else {
        this.compileText(element);
      }
    });
  }
  // vue 源码是如何把节点移动到内存中的？
  // 把节点移动到内存中
  node2fragment(node) {
    // 创建一个文档碎片
    let fragment = document.createDocumentFragment();
    let firstChild;
    while ((firstChild = node.firstChild)) {
      // appendChild 具有移动性
      fragment.appendChild(firstChild);
    }
    return fragment;
  }

  isElementNode(node) {
    // 判断是不是元素节点
    return node.nodeType === 1;
  }
}

// 实现数据劫持
class Observer {
  constructor(data) {
    this.oberver(data);
  }
  oberver(data) {
    // 如果是对象才观察
    if (data && typeof data === "object") {
      // 如果是对象
      for (let key in data) {
        this.defineReactive(data, key, data[key]);
      }
    }
  }
  defineReactive(data, key, value) {
    this.oberver(value);
    let that = this;
    // 给每个属性 都加上一个具有发布订阅的功能
    let dep = new Dep();
    Object.defineProperty(data, key, {
      get() {
        // 创建watcher时，会取到对应的内容,并且把watcher放到了全局上
        if (Dep.target) {
          dep.addSub(Dep.target);
        }
        return value;
      },
      set(newVal) {
        // 老值不等于新值得时候
        if (newVal != value) {
          // 因为有可能存在这种情况 {a:1}={a:3} 对象赋值给对象
          // 如果对象赋值给对象的话 就应该重新监听属性
          that.oberver(newVal);
          value = newVal;
          dep.notify();
        }
      }
    });
  }
}
// 创建一个Vue类
class Vue {
  // options 代表传过来的就是Vue参数对象
  constructor(options) {
    this.$el = options.el;
    this.$data = options.data;
    let computed = options.computed;
    let methods = options.methods;
    // 存在根元素 ，则需要渲染模板
    if (this.$el) {
      // 数据劫持 既是全部转换成用 Object.defineProperty定义
      new Observer(this.$data);

      for (let key in computed) {
        // 有依赖关系
        Object.defineProperty(this.$data, key, {
          get: () => {
            return computed[key].call(this);
          }
        });
      }

      for (let key in methods) {
        // 有依赖关系
        Object.defineProperty(this, key, {
          get: () => {
            return methods[key];
          }
        });
      }

      // 把数据获取操作 vm上的取值操作 都代理到vm.$data
      // 如vm.$data.a = vm.a
      this.proxyVm(this.$data);

      // 模板编译部分
      new Compiler(this.$el, this);
    }
  }
  proxyVm(data) {
    for (let key in data) {
      Object.defineProperty(this, key, {
        // 实现可以通过vm取到对应的内容
        get() {
          return data[key]; // 进行了转换操作
        },
        set(){ // 设置代理方法
            data[key]=newVal
        }
      });
    }
  }
}
