/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule subtractRelayQuery
 * 
 */

'use strict';

var _classCallCheck3 = _interopRequireDefault(require('babel-runtime/helpers/classCallCheck'));

var _possibleConstructorReturn3 = _interopRequireDefault(require('babel-runtime/helpers/possibleConstructorReturn'));

var _inherits3 = _interopRequireDefault(require('babel-runtime/helpers/inherits'));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

/**
 * @internal
 *
 * `subtractRelayQuery(minuend, subtrahend)` returns a new query
 * that matches the structure of `minuend`, minus any fields which also
 * occur in `subtrahend`. Returns null if all fields can be subtracted,
 * `minuend` if no fields can be subtracted, and a new query otherwise.
 */
function subtractRelayQuery(minuend, subtrahend) {
  var visitor = new RelayQuerySubtractor();
  var state = {
    isEmpty: true,
    subtrahend: subtrahend
  };
  var diff = visitor.visit(minuend, state);
  if (!state.isEmpty) {
    require('fbjs/lib/invariant')(diff instanceof require('./RelayQuery').Root, 'subtractRelayQuery(): Expected a subtracted query root.');
    return diff;
  }
  return null;
}

var RelayQuerySubtractor = function (_RelayQueryTransform) {
  (0, _inherits3['default'])(RelayQuerySubtractor, _RelayQueryTransform);

  function RelayQuerySubtractor() {
    (0, _classCallCheck3['default'])(this, RelayQuerySubtractor);
    return (0, _possibleConstructorReturn3['default'])(this, _RelayQueryTransform.apply(this, arguments));
  }

  RelayQuerySubtractor.prototype.visitRoot = function visitRoot(node, state) {
    var subtrahend = state.subtrahend;

    require('fbjs/lib/invariant')(subtrahend instanceof require('./RelayQuery').Root, 'subtractRelayQuery(): Cannot subtract a non-root node from a root.');
    if (!canSubtractRoot(node, subtrahend)) {
      state.isEmpty = false;
      return node;
    }
    return this._subtractChildren(node, state);
  };

  RelayQuerySubtractor.prototype.visitFragment = function visitFragment(node, state) {
    return this._subtractChildren(node, state);
  };

  RelayQuerySubtractor.prototype.visitField = function visitField(node, state) {
    var diff = void 0;
    if (!node.canHaveSubselections()) {
      diff = this._subtractScalar(node, state);
    } else if (node.isConnection()) {
      diff = this._subtractConnection(node, state);
    } else {
      diff = this._subtractField(node, state);
    }
    if (diff && (diff.isRequisite() || !state.isEmpty)) {
      return diff;
    }
    return null;
  };

  RelayQuerySubtractor.prototype._subtractScalar = function _subtractScalar(node, state) {
    var subField = state.subtrahend.getField(node);

    if (subField && !node.isRequisite()) {
      return null;
    }
    state.isEmpty = isEmptyField(node);
    return node;
  };

  RelayQuerySubtractor.prototype._subtractConnection = function _subtractConnection(node, state) {
    var subtrahendRanges = getMatchingRangeFields(node, state.subtrahend);

    if (!subtrahendRanges.length) {
      state.isEmpty = isEmptyField(node);
      return node;
    }

    var diff = node;
    for (var ii = 0; ii < subtrahendRanges.length; ii++) {
      var fieldState = {
        isEmpty: true,
        subtrahend: subtrahendRanges[ii]
      };
      diff = this._subtractChildren(diff, fieldState);
      state.isEmpty = fieldState.isEmpty;
      if (!diff) {
        break;
      }
    }
    return diff;
  };

  /**
   * Subtract a non-scalar/range field.
   */


  RelayQuerySubtractor.prototype._subtractField = function _subtractField(node, state) {
    var subField = state.subtrahend.getField(node);

    if (!subField) {
      state.isEmpty = isEmptyField(node);
      return node;
    }

    var fieldState = {
      isEmpty: true,
      subtrahend: subField
    };
    var diff = this._subtractChildren(node, fieldState);
    state.isEmpty = fieldState.isEmpty;
    return diff;
  };

  /**
   * Subtracts any RelayQuery.Node that contains subfields.
   */


  RelayQuerySubtractor.prototype._subtractChildren = function _subtractChildren(node, state) {
    var _this2 = this;

    return node.clone(node.getChildren().map(function (child) {
      var childState = {
        isEmpty: true,
        subtrahend: state.subtrahend
      };
      var diff = _this2.visit(child, childState);
      state.isEmpty = state.isEmpty && childState.isEmpty;
      return diff;
    }));
  };

  return RelayQuerySubtractor;
}(require('./RelayQueryTransform'));

/**
 * Determine if the subtree is effectively 'empty'; all non-metadata sub-fields
 * have been removed.
 */


function isEmptyField(node) {
  if (node instanceof require('./RelayQuery').Field && !node.canHaveSubselections()) {
    // Note: product-specific hacks use aliased cursors/ids to poll for data.
    // Without the alias check these queries would be considered empty.
    return node.isRequisite() && !node.isRefQueryDependency() && node.getApplicationName() === node.getSchemaName();
  } else {
    return node.getChildren().every(isEmptyField);
  }
}

/**
 * Determine if the two queries have the same root field and identifying arg.
 */
function canSubtractRoot(min, sub) {
  var minIdentifyingCall = min.getIdentifyingArg();
  var subIdentifyingCall = sub.getIdentifyingArg();
  return min.getFieldName() === sub.getFieldName() && require('fbjs/lib/areEqual')(minIdentifyingCall, subIdentifyingCall);
}

/**
 * Find all subfields that may overlap with the range rooted at `node`.
 */
function getMatchingRangeFields(node, subtrahend) {
  return subtrahend.getChildren().filter(function (child) {
    return child instanceof require('./RelayQuery').Field && canSubtractField(node, child);
  });
}

/**
 * Determine if `minField` is a subset of the range specified by `subField`
 * such that they can be subtracted.
 */
function canSubtractField(minField, subField) {
  if (minField.getSchemaName() !== subField.getSchemaName()) {
    return false;
  }
  var minArgs = minField.getCallsWithValues();
  var subArgs = subField.getCallsWithValues();
  if (minArgs.length !== subArgs.length) {
    return false;
  }
  return minArgs.every(function (minArg, ii) {
    var subArg = subArgs[ii];
    if (subArg == null) {
      return false;
    }
    if (minArg.name !== subArg.name) {
      return false;
    }
    if (minArg.name === 'first' || minArg.name === 'last') {
      /* $FlowFixMe(>=0.13.0)
       *
       * subArg and minArg are of type 'Call' (defined in RelayQueryField) which
       * specifies that its 'value' property is nullable. This code assumes that
       * it is not, however, and Flow points out that it may produce
       * `parseInt('undefined')`.
       */
      return parseInt('' + minArg.value, 10) <= parseInt('' + subArg.value, 10);
    }
    return require('fbjs/lib/areEqual')(minArg.value, subArg.value);
  });
}

module.exports = require('./RelayProfiler').instrument('subtractRelayQuery', subtractRelayQuery);