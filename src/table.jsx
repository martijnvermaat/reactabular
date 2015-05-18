'use strict';
var _ = require('lodash');

var merge = _.merge;
var transform = _.transform;
var reduce = _.reduce;
var isFunction = _.isFunction;
var isPlainObject = _.isPlainObject;
var isUndefined = _.isUndefined;

var React = require('react/addons');
var cx = require('classnames');
var formatters = require('./formatters');
var update = React.addons.update;
var EventListener = require('./EventListener');


var getOffset = function(elem) {
    var rect = elem.getBoundingClientRect();
    var docElem = elem.ownerDocument.documentElement;

    return {
        top: rect.top + window.pageYOffset - docElem.clientTop,
        left: rect.left + window.pageXOffset - docElem.clientLeft
    };
};


var getDimension = function(elem, dimension) {
    // http://stackoverflow.com/questions/20926551/recommended-way-of-making-react-component-div-draggable#comment46737351_20927899
    return parseFloat(window.getComputedStyle(elem, null).getPropertyValue(dimension)) || 0;
};


module.exports = React.createClass({
    displayName: 'Table',

    propTypes: {
        header: React.PropTypes.object,
        data: React.PropTypes.array,
        columns: React.PropTypes.array,
        children: React.PropTypes.object,
    },

    getDefaultProps() {
        return {
            header: {},
            data: [],
            columns: []
        };
    },

    getInitialState() {
        return {fixHeader: false};
    },

    componentDidMount() {
        var headers;

        // Cache some DOM references.
        this.table = React.findDOMNode(this);
        headers = this.table.getElementsByTagName('thead')[0].getElementsByTagName('tr');
        this.header = headers[0];
        this.headerCopy = headers[1];

        this.headerCells = this.header.getElementsByTagName('th');
        this.headerCopyCells = this.headerCopy.getElementsByTagName('th');

        this.onWindowScrollListener = EventListener.listen(window, 'scroll', this.updateHeader);
    },

    componentWillUnmount() {
        this.onWindowScrollListener.remove();
    },

    componentDidUpdate() {
        this.updateHeaderWidth();
    },

    updateHeader() {
        var offset = getOffset(this.table);
        var scrolledPastTop = window.pageYOffset > offset.top;
        var notScrolledPastBottom = window.pageYOffset < (offset.top + getDimension(this.table, 'height') - getDimension(this.header, 'height'));

        var fixHeader = scrolledPastTop && notScrolledPastBottom;

        if (this.state.fixHeader !== fixHeader) {
            this.setState({fixHeader: fixHeader});
        }
    },

    updateHeaderWidth() {
        var width;

        for (var i = 0; i < this.headerCopyCells.length; i++) {
            width = this.state.fixHeader ? getDimension(this.headerCopyCells[i], 'width') : null;
            this.headerCells[i].style['min-width'] = width;
            this.headerCells[i].style['max-width'] = width;
        }

        if (this.state.fixHeader) {
            this.header.style.width = getDimension(this.headerCopy, 'width');
        }
    },

    render() {
        var header = this.props.header;
        var data = this.props.data;
        var columns = this.props.columns;

        var props = update(this.props, {
            $merge: {
                header: undefined,
                data: undefined,
                columns: undefined
            }
        });

        var headerCells = () => columns.map((column, i) => {
            var columnHeader = transform(header, (result, v, k) => {
                result[k] = k.indexOf('on') === 0? v.bind(null, column): v;
            });

            return (
                <th
                    key={i + '-header'}
                    className={cx(column.classes)}
                    {...columnHeader}
                >{column.header}</th>
            );
        });

        return (
            <table {...props}>
                <thead>
                    <tr style={{position: this.state.fixHeader ? 'fixed' : 'static', top: 0}}>
                        {headerCells()}
                    </tr>
                    <tr style={{display: this.state.fixHeader ? '' : 'none'}}>
                        {headerCells()}
                    </tr>
                </thead>
                <tbody>
                    {data.map((row, i) => <tr key={i + '-row'}>{
                        columns.map((column, j) => {
                            var property = column.property;
                            var value = row[property];
                            var cell = column.cell || [formatters.identity];
                            var content;

                            cell = isFunction(cell)? [cell]: cell;

                            content = reduce([value].concat(cell), (v, fn) => {
                                if(v && React.isValidElement(v.value)) {
                                    return v;
                                }

                                if(isPlainObject(v)) {
                                    return merge(v, {
                                        value: fn(v.value, data, i, property)
                                    });
                                }

                                var val = fn(v, data, i, property);

                                if(val && !isUndefined(val.value)) {
                                    return val;
                                }

                                // formatter shortcut
                                return {
                                    value: val
                                };
                            });

                            content = content || {};

                            return <td key={j + '-cell'} {...content.props}>{content.value}</td>;
                        }
                    )}</tr>)}
                </tbody>
                {this.props.children}
            </table>
        );
    }
});
