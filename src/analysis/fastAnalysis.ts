import { tokenize } from './tokenizer';
import { ImportType } from '../resolver/resolver';
import { fastAstAnalysis } from './fastAstAnalysis';

//import { AnalysisContext } from "./AnalysisContext";

interface IFastAnalysisProps {
  debug?: boolean;
  input: string;
  parseUsingAst?: boolean;
  locations?: boolean;
}

interface IBrowserEssential {
  variable: string;
  moduleName: string;
}
export interface IFastAnalysis {
  ast?: any;
  imports?: Array<{ type: ImportType; statement: string }>;
  report?: {
    contains__dirname?: boolean;
    contains__filename?: boolean;
    browserEssentials?: Array<IBrowserEssential>;
    dynamicImports?: boolean;
    es6Syntax?: boolean;
    statementsReplaced?: boolean;
    transpiled?: boolean;
    containsJSX?: boolean;
  };
  replaceable?: IStatementReplaceableCollection;
}

export type IStatementReplaceableCollection = Array<IStatementReplaceAble>;
export interface IStatementReplaceAble {
  type: ImportType;
  fromStatement: string;
  toStatement: string;
}
/**
 * AN extremely simple and reliable module extractor based on one very well
 * optmimised Regular expression
 *
 * A benchmark againts acorn shows some dramatic difference which should impact the build time by
 * the amount of gratitude
 *
 * acorn.parse: 17.796312283873558ms (100 runs)
	 fastAnalysis: 2.9928058910369875ms (100 runs)

	 This benchmark includes only parsing for acorn (without traversing the tree and extracting the statements propertly)
	 Which could potetially add a few more ms to the analysis using acorn

	 fastAnalysis is at least 9x faster. IF we imagine 100 files that need to be analysed, it will take 300ms with fastAnalysis, and with acorn that would be 5.7 seconds, and here traversing (not to mention the CPI load).And you will get some 7 seconds of just pointless manipulation.
 * @export
 * @param {IFastAnalysisProps} props
 * @returns {Partial<IFastAnalysis>}
 */

const MODULE_VARS = {
  Buffer: 'buffer',
};
export function fastAnalysis(props: IFastAnalysisProps): IFastAnalysis {
  if (props.parseUsingAst) {
    return fastAstAnalysis({ input: props.input, locations: props.locations });
  }
  const result: IFastAnalysis = {
    imports: [],
    report: {},
  };

  let skip = false;
  const bannedSystemVariables = [];
  tokenize(
    props.input,
    token => {
      if (token.commentStart) {
        skip = true;
      } else if (token.commentEnd) {
        skip = false;
      } else {
        if (skip) {
          return;
        }
      }

      if (token.exportsKeyword) {
        result.report.es6Syntax = true;
        return;
      }
      if (token.systemVariable) {
        const name = token.systemVariable.name;
        if (token.systemVariable.declaration) {
          bannedSystemVariables.push(name);
          return;
        }
        if (bannedSystemVariables.includes(name)) {
          return;
        }
        if (name === '__dirname') {
          result.report.contains__dirname = true;
          return;
        }
        if (name === '__filename') {
          result.report.contains__filename = true;
          return;
        }
        if (!result.report.browserEssentials) {
          result.report.browserEssentials = [];
        }
        if (!result.report.browserEssentials.find(i => i.variable === name)) {
          result.report.browserEssentials.push({
            moduleName: MODULE_VARS[name] ? MODULE_VARS[name] : name,
            variable: name,
          });
        }
      }
      if (token.requireStatement) {
        result.imports.push({ type: ImportType.REQUIRE, statement: token.requireStatement });
      }
      if (token.importFrom) {
        result.report.es6Syntax = true;
        result.imports.push({ type: ImportType.FROM, statement: token.importFrom });
      }
      if (token.importModule) {
        result.report.es6Syntax = true;
        result.imports.push({ type: ImportType.RAW_IMPORT, statement: token.importModule });
      }
      if (token.dynamicImport) {
        result.report.es6Syntax = true;
        result.report.dynamicImports = true;
        result.imports.push({ type: ImportType.DYNAMIC, statement: token.dynamicImport });
      }
    },
    props.debug,
  );
  return result;
}
