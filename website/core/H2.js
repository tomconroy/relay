/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule H2
 */

'use strict';

const React = require('React');
const Header = require('Header');

const H2 = React.createClass({
  render: function() {
    return <Header {...this.props} level={2}>{this.props.children}</Header>
  }
});

module.exports = H2;
