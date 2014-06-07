var homunculus = require('homunculus');
var JsNode = homunculus.getClass('Node', 'es6');

var Class = require('./util/Class');
var SCOPE = {};
SCOPE[JsNode.BLOCK] =
  SCOPE[JsNode.FNBODY] = true;
var NOT_ABS_BLOCK = {};
  NOT_ABS_BLOCK[JsNode.FNBODY] =
    NOT_ABS_BLOCK[JsNode.METHOD] =
      NOT_ABS_BLOCK[JsNode.CLASSBODY] =
        NOT_ABS_BLOCK[JsNode.ITERSTMT] =
          NOT_ABS_BLOCK[JsNode.IFSTMT] = true;

var Scope = Class(function(jsdc) {
  this.jsdc = jsdc;
  this.hash = {};
  this.index = [jsdc.res.length];
}).methods({
  parse: function(node) {
    this.recursion(node);
  },
  recursion: function(node) {
    var self = this;
    var isToken = node.name() == JsNode.TOKEN;
    if(!isToken) {
      //每个{}作用域记录是否有lexdecl
      if(node.name() == JsNode.LEXDECL) {
        var parent = self.closest(node);
        //全局lexdecl没有作用域无需记录
        if(parent) {
          self.hash[parent.nid()] = true;
        }
      }
      node.leaves().forEach(function(leaf) {
        self.recursion(leaf);
      });
    }
  },
  prepose: function(varstmt) {
    var parent = this.closest(varstmt);
    if(parent && this.hash[parent.nid()]) {
      //插入声明的变量到作用域开始，并删除这个var
      var i = this.index[this.index.length - 1];
      this.jsdc.insert('var ' + this.join(varstmt.leaf(1)) + ';', i);
      varstmt.first().token().content('');
      return true;
    }
    return false;
  },
  join: function(node) {
    var first = node.first();
    if(first.name() == JsNode.BINDID) {
      return first.first().token().content();
    }
    return '';
  },
  enter: function(node) {
    this.index.push(this.jsdc.res.length);
  },
  leave: function(node) {
    this.index.pop();
  },
  block: function(node, start) {
    //纯block父节点为blockstmt且祖父节点不是fnbody,method,classbody,iteratorstmt,ifstmt
    //try,catch,final已在父节点不是blockstmt排除
    if(node.name() == JsNode.BLOCK) {
      if(this.hash.hasOwnProperty(node.nid())) {
        node = node.parent();
        var pname = node.name();
        if(pname == JsNode.BLOCKSTMT) {
          pname = node.parent().name();
          if(!NOT_ABS_BLOCK.hasOwnProperty(pname)) {
            this.jsdc.append(start ? '!function() ' : '()');
          }
        }
      }
    }
    //{和}需要添加匿名函数，排除纯block，即父节点不为blockstmt或祖父节点不为fnbody,method,classbody,iteratorstmt,ifstmt
    else if(node.name() == JsNode.TOKEN) {
      node = node.parent();
      if(node.name() == JsNode.BLOCK
        && this.hash.hasOwnProperty(node.nid())) {
        node = node.parent();
        if(node.name() != JsNode.BLOCKSTMT
          || NOT_ABS_BLOCK.hasOwnProperty(node.parent().name())) {
          this.jsdc.append(start ? '!function() {' : '}()');
        }
      }
    }
  },
  closest: function(node) {
    var parent = node;
    while(parent = parent.parent()) {
      if(SCOPE.hasOwnProperty(parent.name())) {
        return parent;
      }
    }
  }
});

module.exports = Scope;
