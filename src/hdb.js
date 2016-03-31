// This file contains additional Squel commands for use with SAP HANA

squel.flavours['hdb'] = function(_squel) {

    let cls = _squel.cls;

    cls.DefaultQueryBuilderOptions.autoQuoteTableNames = true;
    cls.DefaultQueryBuilderOptions.autoQuoteFieldNames = true;
    cls.DefaultQueryBuilderOptions.nameQuoteCharacter = '"';
    cls.DefaultQueryBuilderOptions.tableAliasQuoteCharacter = '"';
    cls.DefaultQueryBuilderOptions.fieldAliasQuoteCharacter = '"';
    cls.DefaultQueryBuilderOptions.parameterCharacter = '?';
    
};

