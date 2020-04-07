const path = require('path');
const fs = require('fs');
//babylon将源码转换成AST
const babylon = require('babylon');
//@babel/traverse 遍历
const traverse = require('@babel/traverse').default;
//@babel/types 替换节点
const types = require('@babel/types');
//babel/generator 生成
const generator = require('@babel/generator').default;
const ejs = require('ejs');

class Compiler {
  constructor(config) {
    //保存配置文件
    this.config = config;
    //保存config中的入口
    this.entryId;
    //保存模块依赖
    this.modules = {};
    //入口路径
    this.entry = config.entry;
    //根目录路径
    this.root = process.cwd();
  }
  getSource(modulePath) {
    let content = fs.readFileSync(modulePath, 'utf8');
    // const rules = this.config.module.rules;
    // for (let i = 0; i < rules.length; i++) {
    //   const rule = rules[i];
    //   const { test, use } = rule;
    //   let len = use.length - 1;
    //   if (test.test(modulePath)) {
    //     function normalLoader() {
    //       const loader = require(use[len--]);
    //       content = loader(content);
    //       if (len > 0) {
    //         normalLoader();
    //       }
    //     }
    //     normalLoader();
    //   }
    // }
    return content;
  }
  parse(source, parentPath) {
    // AST解析语法树
    const ast = babylon.parse(source);
    const dependencies = [];
    traverse(ast, {
      CallExpression(p) {
        const node = p.node;
        if (node.callee.name === 'require') {
          node.callee.name = '__webpack_require__';
          let moduleName = node.arguments[0].value;

          moduleName = moduleName + (path.extname(moduleName) ? '' : '.js');
          moduleName = './' + path.join(parentPath, moduleName);
          dependencies.push(moduleName);
          node.arguments = [types.stringLiteral(moduleName)];
        }
      },
    });
    let sourceCode = generator(ast).code;
    return { sourceCode, dependencies };
  }
  buildModule(modulePath, isEntry) {
    // 获取引入文件内容
    const source = this.getSource(modulePath);
    console.log(source);
    // 获取模块id 即相对路径
    const moduleName = './' + path.relative(this.root, modulePath);
    if (isEntry) {
      this.entryId = moduleName;
    }
    //解析源码并改造返回依赖列表
    const { sourceCode, dependencies } = this.parse(
      source,
      path.dirname(moduleName)
    ); // ./src
    //把模块路径与内容对应起来
    this.modules[moduleName] = sourceCode;
    dependencies.forEach((dep) => {
      this.buildModule(path.join(this.root, dep), false);
    });
  }
  emitFile() {
    // 用数据渲染模板
    // 获取输出目录
    const mainPath = path.join(
      this.config.output.path,
      this.config.output.filename
    );
    const templateStr = this.getSource(path.join(__dirname, 'main.ejs'));
    const code = ejs.render(
      templateStr,
      {
        entryId: this.entryId,
        modules: this.modules,
      },
      {}
    );
    this.assets = {};
    this.assets[mainPath] = code;
    fs.writeFileSync(mainPath, this.assets[mainPath]);
  }
  run() {
    //执行 创建模块依赖关系
    this.buildModule(path.resolve(this.root, this.entry), true);
    //打包后的文件
    this.emitFile();
  }
}

module.exports = Compiler;
