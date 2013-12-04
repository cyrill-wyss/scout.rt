/*******************************************************************************
 * Copyright (c) 2010 BSI Business Systems Integration AG.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *     BSI Business Systems Integration AG - initial API and implementation
 ******************************************************************************/
package org.eclipse.scout.rt.client.ui.basic.table.columns;

import java.math.BigDecimal;
import java.text.DecimalFormat;

import org.eclipse.scout.commons.LocaleThreadLocal;
import org.eclipse.scout.commons.annotations.ConfigProperty;
import org.eclipse.scout.commons.annotations.Order;
import org.eclipse.scout.commons.exception.ProcessingException;
import org.eclipse.scout.rt.client.ui.basic.table.ITableRow;
import org.eclipse.scout.rt.client.ui.form.fields.IFormField;
import org.eclipse.scout.rt.client.ui.form.fields.decimalfield.AbstractDecimalField;

/**
 * Column holding Decimal number
 */
public abstract class AbstractDecimalColumn<T extends Number> extends AbstractNumberColumn<T> implements IDecimalColumn<T> {
  // DO NOT init members, this has the same effect as if they were set AFTER
  // initConfig()
  private int m_fractionDigits;

  public AbstractDecimalColumn() {
    super();
  }

  @Override
  protected int getConfiguredHorizontalAlignment() {
    return 1;
  }

  @Override
  protected int getConfiguredRoundingMode() {
    return BigDecimal.ROUND_HALF_EVEN;
  }

  /*
   * Configuration
   */
  /**
   * Configures the minimum number of fraction digits used to display the value. To use an exact number of fraction
   * digits, the same number as for {@link #getConfiguredMaxFractionDigits()} must be returned.
   * <p>
   * This property only has an effect if no format is specified by {@link #getConfiguredFormat()}.
   * <p>
   * Subclasses can override this method. Default is {@code 2}.
   * 
   * @return Minimum number of fraction digits of this column.
   */
  @ConfigProperty(ConfigProperty.INTEGER)
  @Order(160)
  protected int getConfiguredMinFractionDigits() {
    return 2;
  }

  /**
   * Configures the maximum number of fraction digits used to display the value. To use an exact number of fraction
   * digits, the same number as for {@link #getConfiguredMinFractionDigits()} must be returned.
   * <p>
   * This property only has an effect if no format is specified by {@link #getConfiguredFormat()}.
   * <p>
   * Subclasses can override this method. Default is {@code 2}.
   * 
   * @return maximum number of fraction digits of this column.
   */
  @ConfigProperty(ConfigProperty.INTEGER)
  @Order(170)
  protected int getConfiguredMaxFractionDigits() {
    return 2;
  }

  /**
   * Configures whether the value is a percentage and is displayed with the appropriate sign. A value of 12 is displayed
   * as 12 % (depending on the locale). Use {@link #getConfiguredMultiplier()} to handle the value differently (e.g.
   * display a value of 0.12 as 12 %).
   * <p>
   * Subclasses can override this method. Default is {@code false}.
   * 
   * @return {@code true} if the column represents a percentage value, {@code false} otherwise.
   */
  @ConfigProperty(ConfigProperty.BOOLEAN)
  @Order(180)
  protected boolean getConfiguredPercent() {
    return false;
  }

  /**
   * Configures the multiplier used to display the value. See {@link DecimalFormat#setMultiplier(int)} for more
   * information about multipliers.
   * <p>
   * Subclasses can override this method. Default is {@code 1}.
   * 
   * @return The multiplier used to display the value.
   */
  @ConfigProperty(ConfigProperty.INTEGER)
  @Order(190)
  protected int getConfiguredMultiplier() {
    return 1;
  }

  @ConfigProperty(ConfigProperty.INTEGER)
  @Order(200)
  protected int getConfiguredFractionDigits() {
    return 2;
  }

  @SuppressWarnings("deprecation")
  @Override
  protected void initConfig() {
    super.initConfig();
    setMinFractionDigits(getConfiguredMinFractionDigits());
    setMaxFractionDigits(getConfiguredMaxFractionDigits());
    setPercent(getConfiguredPercent());
    setFractionDigits(getConfiguredFractionDigits());
    setMultiplier(getConfiguredMultiplier());
    if (getConfiguredFormat() != null) {
      getFormatInternal().applyPattern(getConfiguredFormat());
    }
  }

  /*
   * Runtime
   */
  @Override
  public void setMinFractionDigits(int i) {
    if (i > getMaxFractionDigits()) {
      getFormatInternal().setMaximumFractionDigits(i);
    }
    getFormatInternal().setMinimumFractionDigits(i);
  }

  @Override
  public int getMinFractionDigits() {
    return getFormatInternal().getMinimumFractionDigits();
  }

  @Override
  public void setMaxFractionDigits(int i) {
    if (i < getMinFractionDigits()) {
      getFormatInternal().setMinimumFractionDigits(i);
    }
    getFormatInternal().setMaximumFractionDigits(i);
  }

  @Override
  public int getMaxFractionDigits() {
    return getFormatInternal().getMaximumFractionDigits();
  }

  @Override
  public void setPercent(boolean b) {
    DecimalFormat percentDF = (DecimalFormat) DecimalFormat.getPercentInstance(LocaleThreadLocal.get());
    DecimalFormat internalDF = getFormatInternal();
    if (b) {
      internalDF.setPositiveSuffix(percentDF.getPositiveSuffix());
      internalDF.setNegativeSuffix(percentDF.getNegativeSuffix());
    }
    else {
      if (isPercent()) {
        internalDF.setPositiveSuffix("");
        internalDF.setNegativeSuffix("");
      }
    }
  }

  @Override
  public boolean isPercent() {
    DecimalFormat percentDF = (DecimalFormat) DecimalFormat.getPercentInstance(LocaleThreadLocal.get());
    DecimalFormat internalDF = getFormatInternal();
    return internalDF.getPositiveSuffix().equals(percentDF.getPositiveSuffix()) && internalDF.getNegativeSuffix().equals(percentDF.getNegativeSuffix());
  }

  @Override
  public void setFractionDigits(int i) {
    m_fractionDigits = i;
  }

  @Override
  public int getFractionDigits() {
    return m_fractionDigits;
  }

  @Override
  public void setMultiplier(int i) {
    getFormatInternal().setMultiplier(i);
  }

  @Override
  public int getMultiplier() {
    return getFormatInternal().getMultiplier();
  }

  @Override
  protected abstract AbstractDecimalField<T> getEditorField();

  @Override
  protected IFormField prepareEditInternal(ITableRow row) throws ProcessingException {
    AbstractDecimalField<T> f = getEditorField();
    mapEditorFieldProperties(f);
    return f;
  }

  protected void mapEditorFieldProperties(AbstractDecimalField<T> f) {
    super.mapEditorFieldProperties(f);
    f.setFractionDigits(getFractionDigits());
  }
}
