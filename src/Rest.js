var homunculus = require('homunculus');
var JsNode = homunculus.getClass('Node', 'es6');
var Token = homunculus.getClass('Token');

var Class = require('./util/Class');
var join = require('./join');

var Rest = Class(function(jsdc) {
  this.jsdc = jsdc;
  this.hash = {};
  this.hash2 = {};
  this.hash3 = {};
}).methods({
  param: function(fmparams) {
    if(fmparams.name() == JsNode.FMPARAMS && fmparams.size()) {
      var last = fmparams.last();
      var fnbody = fmparams.next().next().next();
      if(last.name() == JsNode.BINDREST) {
        var rest = last.first();
        this.jsdc.ignore(rest, 'rest1');
        this.hash[fnbody.nid()] = {
          index: fmparams.size() - 1,
          token: last.last().first().token()
        };
      }
    }
  },
  enter: function(fnbody) {
    if(this.hash.hasOwnProperty(fnbody.nid())) {
      var o = this.hash[fnbody.nid()];
      var index = o.index;
      var id = o.token.content();
      this.jsdc.append(id + '=[].slice.call(arguments, ' + index + ');');
    }
  },
  expr: function(node) {
    var args = node.last();
    var arglist = args.leaf(1);
    if(arglist.size() > 1) {
      var last = arglist.last();
      var spread = last.prev();
      if(spread.name() == JsNode.TOKEN && spread.token().content() == '...') {
        var first = node.first();
        this.hash2[node.nid()] = first;
        this.jsdc.ignore(arglist, 'rest2');
      }
    }
  },
  args: function(node) {
    var parent = node.parent();
    if(parent.name() == JsNode.CALLEXPR && this.hash2.hasOwnProperty(parent.nid())) {
      this.jsdc.append('.apply');
    }
  },
  arglist: function(node) {
    var parent = node.parent().parent();
    if(parent.name() == JsNode.CALLEXPR && this.hash2.hasOwnProperty(parent.nid())) {
      var mmb = this.hash2[parent.nid()];
      //主表达式无需设置apply的context，成员需设
      this.jsdc.append(mmb.name() == JsNode.MMBEXPR ? join(mmb.first()) : 'this');
      this.jsdc.append(', [');
      var leaves = node.leaves();
      for(var i = 0; i < leaves.length - 3; i++) {
        this.jsdc.append(join(leaves[i]));
      }
      this.jsdc.append(']');
      this.jsdc.append('.concat(');
      this.jsdc.append(node.last().first().token().content());
      this.jsdc.append(')');
    }
  },
  arrltr: function(node, start) {
    if(node.destruct) {
      return;
    }
    if(start) {
      var last = node.last();
      var spread = last.prev();
      if(spread && spread.name() == JsNode.SPREAD) {
        var token = spread.last().last().token();
        this.hash3[node.nid()] = {
          isStr: token.type() == Token.STRING,
          value: token.content()
        };
        this.jsdc.ignore(spread, 'rest3', true);
        var prev = spread.prev();
        if(prev && prev.name() == JsNode.TOKEN && prev.token().content() == ',') {
          this.jsdc.ignore(prev, 'rest4', true);
        }
      }
    }
    else if(this.hash3.hasOwnProperty(node.nid())) {
      var o = this.hash3[node.nid()];
      this.jsdc.appendBefore('.concat(');
      if(o.isStr) {
        this.jsdc.appendBefore(o.value);
        this.jsdc.appendBefore('.split("")');
      }
      else {
        this.jsdc.appendBefore('function(){var ');
        var temp = this.jsdc.uid();
        var temp2 = this.jsdc.uid();
        this.jsdc.appendBefore(temp);
        this.jsdc.appendBefore('=[],' + temp2);
        this.jsdc.appendBefore(';while(!' + temp2 + '=' + o.value + '.next().done)');
        this.jsdc.appendBefore(temp + '.push(' + temp2 + '.value)}()');
      }
      this.jsdc.appendBefore(')');
    }
  }
});

module.exports = Rest;
