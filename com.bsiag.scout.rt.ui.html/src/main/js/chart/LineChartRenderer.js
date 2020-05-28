/*
 * Copyright (c) 2014-2020 BSI Business Systems Integration AG.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the BSI CRM Software License v1.0
 * which accompanies this distribution as bsi-v10.html
 *
 * Contributors:
 *     BSI Business Systems Integration AG - initial API and implementation
 */
import {strings} from '@eclipse-scout/core';
import {AbstractGridChartRenderer} from '../index';
import $ from 'jquery';

export default class LineChartRenderer extends AbstractGridChartRenderer {

  constructor(chart) {
    super(chart);
    this.glowClass = 'glow' + this.chart.id;
    this.numSupportedColors = 6;
    this.segmentSelectorForAnimation = 'path.line-chart-line';
  }

  _validate() {
    if (!super._validate()) {
      return false;
    }
    if (this.chart.data.axes[0].length < 2 ||
      this.chart.data.chartValueGroups[0].values.length < 2) {
      return false;
    }
    return true;
  }

  _renderInternal() {
    super._renderInternal();
    let i,
      j,
      chartValueGroups = this.chart.data.chartValueGroups,
      widthPerX = this.getWidthPerX(),
      width = this.getWidth(chartValueGroups);

    // Grid
    let yLabels = this._createYLabelsAndAdjustDimensions(this.possibleYLines);

    this.renderYGrid(yLabels);
    this._renderAxisLabels();

    // Lines
    let chartValueGroup,
      that = this,
      moveUpFunc = function(now, fx) {
        let $this = $(this),
          pointValues = $this.data('pointValues'),
          d = that._calcDForValuesString(pointValues, fx.pos, false),
          $highlightPath = $this.data('$highlightPath');

        $this.attr('d', d);
        $highlightPath.attr('d', d);

      },
      lineColors = [];

    let handleHover = function(event) {
        let $this = $(this);
        let $path = $this.data('$path');
        $path.addClass('hover-style');
        $path.data('$bubbles').forEach($elem => {
          $elem.attr('opacity', 1);
        });
      },
      hoverOff = function(event) {
        let $this = $(this);
        let $path = $this.data('$path');
        $path.removeClass('hover-style');
        $path.data('$bubbles').forEach($elem => {
          $elem.attr('opacity', 0);
        });
      };
    this.$paths = [];
    for (i = 0; i < chartValueGroups.length; i++) {
      chartValueGroup = chartValueGroups[i];
      let lineClass = 'line-chart-line',
        legendClass = 'line-chart-line',
        pointValues = [],
        d = '';
      if (this.chart.config.options.autoColor) {
        lineClass += ' stroke-color' + (i % this.numSupportedColors);
        legendClass += ' color' + (i % this.numSupportedColors);
        lineColors[i] = null;
      } else if (chartValueGroup.cssClass) {
        lineClass += ' ' + chartValueGroup.cssClass;
        legendClass += ' ' + chartValueGroup.cssClass;
        lineColors[i] = null;
      } else {
        lineColors[i] = chartValueGroup.colorHexValue;
      }
      this._renderLegendEntry(chartValueGroup.groupName, lineColors[i], legendClass, i);

      // Loop over each pair of points
      for (j = 0; j < chartValueGroup.values.length; j++) {
        pointValues.push(chartValueGroup.values[j]);
        let yCoord = this.animationDuration ? this._calculateYCoordinate(0) : this._calculateYCoordinate(chartValueGroup.values[j]);
        if (j === 0) {
          d += this._addFirstPoint(this._calculateXCoordinate(j), yCoord);
        } else {
          d += this._addLinePoint(this._calculateXCoordinate(j), yCoord);
        }

        if (i === 0) {
          this.renderXGridLabel(chartValueGroups, j, width, widthPerX, true);
        }
      }
      // Draw a line from "j" to "j + 1"
      let $path = this.$svg.appendSVG('path', lineClass)
        .attr('d', d)
        .attr('fill', 'none')
        .data('pointValues', pointValues);

      let $highlightPath = this.$svg.appendSVG('path', 'highlight path')
        .attr('d', d)
        .attr('opacity', '0')
        .attr('fill', 'none')
        .attr('stroke-width', '14px')
        .attr('stroke', '#ccc')
        .data('$path', $path);

      $path.data('$highlightPath', $highlightPath);
      $highlightPath
        .mouseenter(handleHover)
        .mouseleave(hoverOff);

      if (this.animationDuration) {
        $path
          .animate({
            tabIndex: 0
          }, this._createAnimationObjectWithTabindexRemoval(moveUpFunc, this.animationDuration));

      }
      if (lineColors[i]) {
        $path.attr('stroke', lineColors[i]);
      }
      $path.data('$bubbles', []);
      this.$paths.push($path);
    }

    // Data points (not inside "Lines" loop to draw them over the lines)
    for (i = 0; i < chartValueGroups.length; i++) {
      chartValueGroup = chartValueGroups[i];
      for (j = 0; j < chartValueGroup.values.length; j++) {
        this._renderValueBubble(j, chartValueGroup.values[j], 5, lineColors[i], i);
      }
    }
    this.handleTooBigLabels(widthPerX);
  }

  _calcDForValuesString(valuesArr, fxPos, negativeDirection) {
    if (!valuesArr) {
      return '';
    }
    let d = '';
    if (fxPos === undefined) {
      fxPos = 1;
    }
    if (negativeDirection) {
      fxPos = 1 - fxPos;
    }
    for (let i = 0; i < valuesArr.length; i++) {
      if (i === 0) {
        d += this._addFirstPoint(this._calculateXCoordinate(i), this._calculateYCoordinate(valuesArr[i] * fxPos));
      } else {
        d += this._addLinePoint(this._calculateXCoordinate(i), this._calculateYCoordinate(valuesArr[i] * fxPos));
      }
    }
    return d;
  }

  _addLinePoint(x, y) {
    return 'L' + x + ',' + y + ' ';
  }

  _addFirstPoint(x, y) {
    return 'M' + x + ',' + y + ' ';
  }

  _removeAnimated(afterRemoveFunc) {
    if (this.animationTriggered) {
      return;
    }
    let yCoord = 0,
      that = this,
      moveDownFunc = function(now, fx) {
        let $this = $(this),
          $highlightPath = $this.data('$highlightPath'),
          pointValues = $this.data('pointValues'),
          d = that._calcDForValuesString(pointValues, fx.pos, true);
        $this.attr('d', d);
        $highlightPath.attr('d', d);
      };
    if (this.$svg.children('.line-chart-line').length > 0) {
      yCoord = this._calculateYCoordinate(0);
    }

    this.animationTriggered = true;
    this.$svg.children(this.segmentSelectorForAnimation)
      .animate({
        tabIndex: 0
      }, this._createAnimationObjectWithTabindexRemoval(moveDownFunc))
      .promise()
      .done(() => {
        this._remove(afterRemoveFunc);
        this.animationTriggered = false;
      });
  }

  _renderValueBubble(index, value, radius, color, groupIndex) {
    let x = this._calculateXCoordinate(index),
      y = this.animationDuration ? this._calculateYCoordinate(0) : this._calculateYCoordinate(value),
      endY = this._calculateYCoordinate(value);

    let colorClass;
    if (this.chart.config.options.autoColor) {
      colorClass = 'stroke-color' + (groupIndex % this.numSupportedColors);
    } else {
      colorClass = this.chart.data.chartValueGroups[groupIndex].cssClass || '';
    }

    let $bubble = this.$svg.appendSVG('circle', 'line-chart-value-bubble' + strings.box(' ', colorClass, ''))
      .attr('cx', x)
      .attr('cy', y)
      .attr('r', radius)
      .attr('opacity', 0);
    if (color) {
      $bubble.attr('stroke', color);
    }
    if (this.animationDuration) {
      $bubble.animateSVG('cy', endY, this.animationDuration, null, true);
    }

    let legendPositions = {
      x1: x,
      x2: x + 2 * radius,
      y1: this._calculateYCoordinate(value) - radius,
      y2: this._calculateYCoordinate(value) - 4 * radius,
      v: -1,
      h: 1
    };
    // calculate opening direction
    let labelPositionFunc = function(labelWidth, labelHeight) {
      if (value <= 0 || legendPositions.y2 - labelHeight < 0) {
        legendPositions.v = 1;
        if (0 > x - 2 * radius - labelWidth) {
          legendPositions.h = 1;
        } else {
          legendPositions.h = -1;
          legendPositions.x2 = x - 2 * radius;
        }
        legendPositions.y1 = this._calculateYCoordinate(value) + radius;
        legendPositions.y2 = this._calculateYCoordinate(value) + 4 * radius;
      }
      // check if left is enough space
      if (this.chartDataAreaWidth < legendPositions.x2 + labelWidth) {
        legendPositions.h = -1;
        legendPositions.x2 = x - 2 * radius;
      }
      return legendPositions;
    };

    legendPositions.autoPosition = true;
    legendPositions.posFunc = labelPositionFunc;

    let groupName = this.chart.data.chartValueGroups[groupIndex].groupName;
    let legend = this._renderWireLegend(
      strings.join(': ', groupName, this.session.locale.decimalFormat.format(value)),
      legendPositions, 'line-chart-wire-label', false);
    legend.detachFunc();

    let that = this,
      mouseIn = function() {
        legend.attachFunc();
        $(this).data('$path').addClass('hover-style');
        if (that.toBigLabelHoverFunc) {
          that.toBigLabelHoverFunc(that.xAxisLabels[index]);
        }
      },
      mouseOut = function() {
        legend.detachFunc();
        $(this).data('$path').removeClass('hover-style');
        if (that.toBigLabelHoverFunc) {
          that.toBigLabelHoverOffFunc(that.xAxisLabels[index]);
        }
      };
    this.$paths[groupIndex].data('$bubbles').push($bubble);

    $bubble.on('click', this._createClickObject(0, index, groupIndex), this.chart._onValueClick.bind(this.chart));

    $bubble
      .mouseenter(mouseIn)
      .mouseleave(mouseOut)
      .data('$path', this.$paths[groupIndex])
      .data('legend', legend);
  }
}
