/*
 * Copyright (c) 2010-2022 BSI Business Systems Integration AG.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *     BSI Business Systems Integration AG - initial API and implementation
 */
import {Device, Tooltip, TooltipSupport} from '../index';
import $ from 'jquery';
import {TooltipSupportOptions} from './TooltipSupport';
import {InitModelOf} from '../scout';

const DEFAULT_TOOLTIP_DELAY = 600; // ms

// Quite long tooltip delay for cases where the normal delay would be annoying
const LONG_TOOLTIP_DELAY = 1000; // ms

export function install($comp: JQuery, options: InitModelOf<TooltipSupport>) {
  let support = $comp.data('tooltipSupport') as TooltipSupport;
  if (!support) {
    support = new TooltipSupport(options);
    support.install($comp);
  } else {
    support.update($comp, options);
  }
}

export function uninstall($comp: JQuery) {
  let support = $comp.data('tooltipSupport') as TooltipSupport;
  if (support) {
    support.uninstall($comp);
  }
}

/**
 * If the tooltip is currently showing, its contents are updated immediately.
 * Otherwise, nothing happens.
 */
export function update($comp: JQuery, options?: Partial<TooltipSupportOptions>) {
  let support = $comp.data('tooltipSupport') as TooltipSupport;
  if (support) {
    support.update($comp, options);
  }
}

export function close($comp: JQuery) {
  let support = $comp.data('tooltipSupport') as TooltipSupport;
  if (support) {
    support.close();
  }
}

/**
 * Cancels the scheduled task to show the tooltip.
 */
export function cancel($comp: JQuery) {
  let support = $comp.data('tooltipSupport') as TooltipSupport;
  if (support) {
    support.cancel($comp);
  }
}

/**
 * Convenient function to install tooltip support for ellipsis only.
 */
export function installForEllipsis($comp: JQuery, options: InitModelOf<TooltipSupport>) {
  let defaultOptions = {
    text: $label => {
      if ($label.isContentTruncated()) {
        return $label.text();
      }
    },
    nativeTooltip: !Device.get().isCustomEllipsisTooltipPossible()
  };
  options = $.extend({}, defaultOptions, options);
  install($comp, options);
}

/**
 * Finds every tooltip whose $anchor belongs to $context.
 */
export function find($context: JQuery): Tooltip[] {
  let $tooltips, i, tooltip, tooltips = [];
  $tooltips = $('.tooltip', $context.document(true));

  for (i = 0; i < $tooltips.length; i++) {
    tooltip = $tooltips.eq(i).data('tooltip');
    if ($context.has(tooltip.$anchor).length > 0) {
      tooltips.push(tooltip);
    }
  }
  return tooltips;
}

export default {
  DEFAULT_TOOLTIP_DELAY,
  LONG_TOOLTIP_DELAY,
  cancel,
  close,
  find,
  install,
  installForEllipsis,
  uninstall,
  update
};
