// This file contains additional Squel commands for use with SAP HANA

squel.flavours['hdb'] = function(_squel) {

    let cls = _squel.cls;

    // hdb query builder options
    cls.DefaultQueryBuilderOptions = {
        autoQuoteTableNames: true,
        autoQuoteFieldNames: true,
        nameQuoteCharacter: '"',
        tableAliasQuoteCharacter: '"',
        fieldAliasQuoteCharacter: '"',
        parameterCharacter: '?'
    };
    

};

