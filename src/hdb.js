// This file contains additional Squel commands for use with SAP HANA

squel.flavours['hdb'] = function(_squel) {

    let cls = _squel.cls;

    cls.DefaultQueryBuilderOptions.autoQuoteTableNames = true;
    cls.DefaultQueryBuilderOptions.autoQuoteFieldNames = true;
    cls.DefaultQueryBuilderOptions.nameQuoteCharacter = '"';
    cls.DefaultQueryBuilderOptions.tableAliasQuoteCharacter = '"';
    cls.DefaultQueryBuilderOptions.fieldAliasQuoteCharacter = '"';
    cls.DefaultQueryBuilderOptions.parameterCharacter = '?';

    _squel.registerValueHandler(Date, function(value, asParam) {
        if (asParam) {
            return value;
        } else {
            let formatedDate = value.toLocaleFormat("%Y-%m-%dT%H:%M:%S");
            return `'${formatedDate}'`;
        }
    });

    cls.HdbAbstractTableBlock = class extends cls.AbstractTableBlock {
        constructor (options) {
            super(options);
            this.tables = [];
        }

        _table (table, alias = null) {
            if (alias) {
                alias = this._sanitizeTableAlias(alias);
            }

            let schema;
            if (_isArray(table) && table.length == 2) {
                schema = table[0];
                table = table[1];
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
        table (table, alias = null) {
            this._table(table, alias);
        }
    }

    // FROM table
    cls.FromTableBlock = class extends cls.HdbAbstractTableBlock {
        from (table, alias = null) {
            this._table(table, alias);
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

        into (table) {

            let schema;
            if (_isArray(table) && table.length == 2) {
                schema = table[0];
                table = table[1];
            }

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


    cls.HdbJoinBlock = class extends cls.Block {
        constructor (options) {
            super(options);
            this.joins = [];
        }

        join (table, alias = null, condition = null, type = 'INNER') {
            let schema;
            if (_isArray(table) && table.length == 2) {
                schema = table[0];
                table = table[1];
            }

            table = this._sanitizeTable(table, true);
            if (schema) {
                schema = this._sanitizeTable(schema, false);
                table = `${schema}.${table}`;
            }
            alias = alias ? this._sanitizeTableAlias(alias) : alias;
            condition = condition ? this._sanitizeCondition(condition) : condition;

            this.joins.push({
                type: type,
                table: table,
                alias: alias,
                condition: condition
            });
        }

        left_join (table, alias = null, condition = null) {
            this.join(table, alias, condition, 'LEFT');
        }

        right_join (table, alias = null, condition = null) {
            this.join(table, alias, condition, 'RIGHT');
        }

        outer_join (table, alias = null, condition = null) {
            this.join(table, alias, condition, 'OUTER');
        }

        left_outer_join (table, alias = null, condition = null) {
            this.join(table, alias, condition, 'LEFT OUTER');
        }

        full_join (table, alias = null, condition = null) {
            this.join(table, alias, condition, 'FULL');
        }

        cross_join (table, alias = null, condition = null) {
            this.join(table, alias, condition, 'CROSS');
        }

        buildStr (queryBuilder) {
            let joins = "";

            _forOf(this.joins || [], (j) => {
                if (joins.length) {
                    joins += " ";
                }

                joins += `${j.type} JOIN `;
                if ("string" === typeof j.table) {
                    joins += j.table;
                }
                else {
                    joins += `(${j.table})`;
                }
                if (j.alias) {
                    joins += ` ${j.alias}`;
                }
                if (j.condition) {
                    joins += ` ON (${j.condition})`
                }
            });

            return joins;
        }

        buildParam (queryBuilder) {
            let ret = {
                text: "",
                values: [],
            };

            let params = [];
            let joinStr = "";

            if (0 >= this.joins.length) {
                return ret;
            }

            // retrieve the parameterised queries
            _forOf(this.joins, (blk) => {
                let p;
                if ("string" === typeof blk.table) {
                    p = { "text": `${blk.table}`, "values": [] };
                }
                else if (blk.table instanceof cls.QueryBuilder) {
                    // building a nested query
                    blk.table.updateOptions( { "nestedBuilder": true } );
                    p = blk.table.toParam();
                }
                else {
                    // building a nested query
                    blk.updateOptions( { "nestedBuilder": true } );
                    p = blk.buildParam(queryBuilder);
                }

                if (blk.condition instanceof cls.Expression) {
                    let cp = blk.condition.toParam();
                    p.condition = cp.text;
                    p.values = p.values.concat(cp.values);
                }
                else {
                    p.condition = blk.condition;
                }

                p.join = blk;
                params.push( p );
            });

            // join the queries and their parameters
            // this is the last building block processed so always add UNION if there are any UNION blocks
            _forOf(params, (p) => {
                if (joinStr.length) {
                    joinStr += " ";
                }

                joinStr += `${p.join.type} JOIN `;

                if ("string" === typeof p.join.table) {
                    joinStr += p.text;
                }
                else {
                    joinStr += `(${p.text})`;
                }
                if (p.join.alias) {
                    joinStr += ` ${p.join.alias}`;
                }
                if (p.condition) {
                    joinStr += ` ON (${p.condition})`;
                }

                _forOf(p.values, (v) => {
                    ret.values.push( this._formatCustomValue(v) );
                });
            });

            ret.text += joinStr;

            return ret;
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

    // SELECT query builder.
    cls.Select = class extends cls.QueryBuilder {
        constructor (options, blocks = null) {

            blocks = blocks || [
                    new cls.StringBlock(options, 'SELECT'),
                    new cls.FunctionBlock(options),
                    new cls.DistinctBlock(options),
                    new cls.GetFieldBlock(options),
                    new cls.FromTableBlock(_extend({}, options, { allowNested: true })),
                    new cls.HdbJoinBlock(_extend({}, options, { allowNested: false })),
                    new cls.WhereBlock(options),
                    new cls.GroupByBlock(options),
                    new cls.HavingBlock(options),
                    new cls.OrderByBlock(options),
                    new cls.LimitBlock(options),
                    new cls.OffsetBlock(options),
                    new cls.UnionBlock(_extend({}, options, { allowNested: true })),
                ];

            super(options, blocks);
        }

        isNestable () {
            return true;
        }
    }
};

