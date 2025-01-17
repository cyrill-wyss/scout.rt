/*
 * Copyright (c) 2014-2017 BSI Business Systems Integration AG.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *     BSI Business Systems Integration AG - initial API and implementation
 */
import {objects} from '../index';

/**
 * JavaScript port from java.util.TreeSet.
 */
export default class TreeSet {

  constructor() {
    this.array = [];
    this.properties = objects.createMap();
  }

  add(value) {
    if (!this.contains(value)) {
      this.array.push(value);
      this.array.sort();
      this.properties[value] = true;
    }
  }

  size() {
    return this.array.length;
  }

  contains(value) {
    return (value in this.properties);
  }

  last() {
    return this.array[this.array.length - 1];
  }
}
