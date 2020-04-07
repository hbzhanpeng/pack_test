#!/usr/bin/env node
const path = require('path');
const Compiler = require('../lib/Compiler.js');

// 1. 拿到webpack.config.js
const config = require(path.resolve('webpack.config.js'));

const compiler = new Compiler(config);
//运行编译
compiler.run();
