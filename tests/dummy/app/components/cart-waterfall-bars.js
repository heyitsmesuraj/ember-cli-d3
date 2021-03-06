import Ember from 'ember';
import d3 from 'd3';
import hbs from 'htmlbars-inline-precompile';

import GraphicSupport from 'ember-cli-d3/mixins/d3-support';
import MarginConvention from 'ember-cli-d3/mixins/margin-convention';

import { join, translateX } from 'ember-cli-d3/utils/d3';
import { scan } from 'ember-cli-d3/utils/lodash';
import { computed } from 'ember-cli-d3/utils/version';

export default Ember.Component.extend(GraphicSupport, MarginConvention, {
  requiredProperties: [ 'model' ],
  layout: hbs`
    {{#if model}}
      {{yield seriesSelection xScale yScale contentWidth contentHeight}}
    {{/if}}
  `,

  defaultMargin: 60,

  model: null,

  layoutValues: computed('model.{data,series,key}', function () {
    var data = this.get('model.data');
    var series = this.get('model.series');
    var key = this.get('model.key');

    var base = 0;

    return data.reduce((accum, datum) => {
      accum[datum[key]] = series.reduce((accum, series) => {
        var change = datum[series];
        var start = base;
        var end = base + change;

        base += change;

        accum[series] = { start, end, change };

        return accum;
      }, {});

      return accum;
    }, {});
  }).readOnly(),
  xScale: computed('contentWidth', 'model.{data,key}', function () {
    var width = this.get('contentWidth');
    var data = this.get('model.data');
    var key = this.get('model.key');

    return d3.scale.ordinal()
      .domain(!key ? data : data.map((data) => Ember.get(data, key)))
      .rangeBands([ 0, width ], 0.5);
  }).readOnly(),
  yScale: computed('contentHeight', 'model.data', 'model.series', function () {
    var height = this.get('contentHeight');
    var data = this.get('model.data');
    var series = this.get('model.series');
    var base = 0;
    var extent = [ base, base ];

    data.forEach(datum => {
      series.forEach((series) => {
        base += datum[series];

        extent[0] = Math.min(extent[0], base);
        extent[1] = Math.max(extent[1], base);
      });
    });

    return d3.scale.linear()
      .domain(extent)
      .range([ 0, -height ]);
  }).readOnly(),
  zScale: computed('xScale', 'model.series', function () {
    var series = this.get('model.series');
    var band = this.get('xScale').rangeBand();

    return d3.scale.ordinal()
      .domain(series.map((series) => series))
      .rangePoints([ 0, band ], 1);
  }).readOnly(),

  call(selection) {
    var context = this;
    var top = this.get('margin.top');
    var left = this.get('margin.left');
    var height = this.get('contentHeight');
    var elementId = context.elementId;

    selection.each(function () {
      context.series(d3.select(this).attr('id', elementId).attr('transform', `translate(${left} ${top + height})`));
    });

    this.set('seriesSelection', selection.selectAll('.series'));
  },

  series: join('model.series', '.series', {
    enter(sel) {
      var context = this;
      var color = this.get('stroke');
      var zScale = this.get('zScale');

      sel.append('g')
          .style('stroke', (series) => color(series))
          .attr('class', 'series')
          .attr('transform', (series) => `translate(${zScale(series)} 0)`)
        .each(function (data) {
          context.bars(d3.select(this), data);
        });
    },

    update(sel) {
      var context = this;
      var color = this.get('stroke');
      var zScale = this.get('zScale');

      d3.transition(sel).attr('transform', (series) => `translate(${zScale(series)} 0)`)
        .style('stroke', (series) => color(series))
        .each(function (data) {
          context.bars(d3.select(this), data);
        });
    }
  }),

  bars: join('model.data[model.key]', '.bar', {
    enter(sel) {
      var xScale = this.get('xScale');
      var yScale = this.get('yScale');
      var key = this.get('model.key');
      var zero = yScale(0);

      sel
          .append('g')
        .attr('class', 'bar')
        .attr('transform', translateX(record => xScale(Ember.get(record, key))))
          .append('line')
        .attr('class', 'shape')
          .attr('x1', 0)
          .attr('x2', 0)
          .attr('y1', zero)
          .attr('y2', zero);
    },
    update(sel, series) {
      var xScale = this.get('xScale');
      var yScale = this.get('yScale');
      var key = this.get('model.key');

      var layout = this.get('layoutValues');

      d3.transition(sel)
          .attr('transform', translateX(record => xScale(Ember.get(record, key))))
        .select('.shape')
          .attr('x1', 0)
          .attr('x2', 0)
          .attr('y1', record => yScale(layout[record[key]][series].start))
          .attr('y2', record => yScale(layout[record[key]][series].end));
    }
  })
});
