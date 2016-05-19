var proxy = require('../src/proxy');

describe('proxy', function () {
    describe('#call()', function () {
        it('should throw an error', function () {
            expect(function () {
                proxy.call();
            }).to.throw('Please specify a url');
        });
    });
});