// This file contains additional Squel commands for use with SAP HANA

squel.flavours['hdb'] = function(_squel) {

    let cls = _squel.cls;

    cls.DefaultQueryBuilderOptions.autoQuoteTableNames = true;
    cls.DefaultQueryBuilderOptions.autoQuoteFieldNames = true;
    cls.DefaultQueryBuilderOptions.nameQuoteCharacter = '"';
    cls.DefaultQueryBuilderOptions.tableAliasQuoteCharacter = '"';
    cls.DefaultQueryBuilderOptions.fieldAliasQuoteCharacter = '"';
    cls.DefaultQueryBuilderOptions.parameterCharacter = '?';

    cls.HdbAbstractTableBlock = class extends cls.AbstractTableBlock {
        constructor (options) {
            super(options);
            this.tables = [];
        }

        _table (schema, table, alias = null) {
            if (alias) {
                alias = this._sanitizeTableAlias(alias);
            }

            table = this._sanitizeTable(table, false);
            if (schema) {
                schema = this._sanitizeTable(schema, false);
                table = `${schema}.${table}`;
            }

            if (this.options.singleTable) {
                this.tables = [];
            }

            this.tables.push({
                table: table,
                alias: alias,
            });
        }
    }

    // Update Table
    cls.HdbUpdateTableBlock = class extends cls.HdbAbstractTableBlock {
        table (schema, table, alias = null) {
            this._table(schema, table, alias);
        }
    }

    // FROM table
    cls.FromTableBlock = class extends cls.HdbAbstractTableBlock {
        from (schema, table, alias = null) {
            this._table(schema, table, alias);
        }

        buildStr (queryBuilder) {
            let tables = super.buildStr(queryBuilder);
            return tables.length ? `FROM ${tables}` : "";
        }

        buildParam (queryBuilder) {
            return this._buildParam(queryBuilder, "FROM");
        }
    }


    // INTO table
    cls.HdbIntoTableBlock = class extends cls.Block {
        constructor (options) {
            super(options);
            this.table = null;
        }

        into (schema, table) {
            this.table = this._sanitizeTable(table, false);
            if (schema) {
                schema = this._sanitizeTable(schema, false);
                this.table = `${schema}.${this.table}`;
            }
        }

        buildStr (queryBuilder) {
            if (!this.table) {
                throw new Error("into() needs to be called");
            }
            return `INTO ${this.table}`;
        }
    }

    // UPDATE query builder.
    cls.Update = class extends cls.QueryBuilder {
        constructor (options, blocks = null) {
            blocks = blocks || [
                    new cls.StringBlock(options, 'UPDATE'),
                    new cls.HdbUpdateTableBlock(options),
                    new cls.SetFieldBlock(options),
                    new cls.WhereBlock(options),
                    new cls.OrderByBlock(options),
                    new cls.LimitBlock(options),
                ];

            super(options, blocks);
        }
    }

    // An INSERT query builder.
    cls.Insert = class extends cls.QueryBuilder {
        constructor (options, blocks = null) {
            blocks = blocks || [
                    new cls.StringBlock(options, 'INSERT'),
                    new cls.HdbIntoTableBlock(options),
                    new cls.InsertFieldValueBlock(options),
                    new cls.InsertFieldsFromQueryBlock(options),
                ];

            super(options, blocks);
        }
    }

};

