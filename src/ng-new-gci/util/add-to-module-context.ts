import * as ts from 'typescript';

export class AddToModuleContext {
  // source of the module file
  source: ts.SourceFile;

  // Relative path, that points from the module to the import
  relativePath: string;

  // name of the import
  classifiedName: string;
}
