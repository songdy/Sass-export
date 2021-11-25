const VARIABLE_PATERN = '(?!\\d)[\\w_-][\\w\\d_-]*';
const VALUE_PATERN = '[^;]+|"(?:[^"]+|(?:\\\\"|[^"])*)"';
const EXTEND_PATERN = `\\s*(?<!\\w+)(?:@sass-export-(\\w+)=)(".+?")\\s*`;
const ANNOTATION_PATERN = `(?:/\\*|\\/\\/)(${EXTEND_PATERN})*(?:\\*/)`
const DECLARATION_PATTERN =
  `\\$['"]?(${VARIABLE_PATERN})['"]?\\s*:\\s*(${VALUE_PATERN})(?:\\s*!(global|default)\\s*;|\\s*;(?![^\\{]*\\}))\\s*(${ANNOTATION_PATERN})?`;

const MAP_DECLARATIOM_REGEX = `['"]?((?!\\d)[\\w_-][\\w\\d_-]*)['"]?\\s*:\\s*([a-z\\-]+\\([^\\)]+\\)|[^\\)\\(,\\/]+|\\([^\\)]+\\))(,\\s*${ANNOTATION_PATERN})?`;
const QUOTES_PATTERN = /^(['"]).*\1$/;
const QUOTES_REPLACE = /^(['"])|(['"])$/g;

const SECTION_TAG = 'sass-export-subsection';
const SECTION_PATTERN = `(@${SECTION_TAG}=)(".+")`;
const END_SECTION_PATTERN = `(@end-${SECTION_TAG})`;

const DEFAULT_SECTION = 'variables';


export class Parser {
  private rawContent: string;

  constructor(rawContent: string) {
    this.rawContent = rawContent;
  }

  public parse(): IDeclaration[] {
    let matches = this.extractDeclarations(this.rawContent);
    let declarations = [];

    for (let match of matches) {
      if (!this.checkIsSectionStart(match) && !this.checkIsSectionStart(match)) {
        let parsed = this.parseSingleDeclaration(match);

        if (parsed) {
          this.parseMapDeclarations(parsed);
          declarations.push(parsed);
        }
      }
    }

    return declarations;
  }


  public parseStructured(): any {
    let matches = this.extractDeclarationsStructured(this.rawContent);
    let currentSection = DEFAULT_SECTION;
    let declarations = {};

    if (!matches || !matches.length) {
      return {};
    }

    declarations[currentSection] = [];

    for (let match of matches) {
      if (this.checkIsSectionStart(match)) {
        let sectionName = String(new RegExp(SECTION_PATTERN, 'gi').exec(match)[2]);

        if (sectionName) {
          currentSection = sectionName.replace(/"/g, '');
          declarations[currentSection] = declarations[currentSection] || [];
        }
      } else if (this.checkIsSectionEnd(match)) {
        currentSection = DEFAULT_SECTION;
      } else {
        let parsed = this.parseSingleDeclaration(match);

        if (parsed) {
          this.parseMapDeclarations(parsed);
          declarations[currentSection].push(parsed);
        }
      }
    }

    return declarations;
  }


  private extractDeclarationsStructured(content: string): [any] {
    const matches = content.match(new RegExp(`${DECLARATION_PATTERN}|${SECTION_PATTERN}|${END_SECTION_PATTERN}`, 'g'));

    if (!matches) {
      return [] as any;
    }

    return matches as any;
  }


  private extractDeclarations(content: string): [any] {
    const matches = content.match(new RegExp(DECLARATION_PATTERN, 'g'));

    if (!matches) {
      return [] as any;
    }

    return matches as any;
  }

  private extractMapDeclarations(content: string): [any] {
    const matches = content.match(new RegExp(MAP_DECLARATIOM_REGEX, 'gi'));
    if (!matches) {
      return [] as any;
    }

    return matches as any;
  }


  private parseSingleDeclaration(matchDeclaration: string): IDeclaration {
    let matches = matchDeclaration
      .replace(/\s*!(default|global)\s*;/, ';')
      .match(new RegExp(DECLARATION_PATTERN));

    if (!matches) {
      return;
    }
    let name = matches[1].trim().replace('_', '-');
    let value = matches[2].trim().replace(/\s*\n+\s*/g, ' ');

    if (value.match(QUOTES_PATTERN)) {
      value = value.replace(QUOTES_REPLACE, '');
    }

    let extendFields = {}
    if(matches[4]){
      let extendList = matches[4].match(new RegExp(EXTEND_PATERN, 'g'));
      if(extendList){
        // console.log(extendList)
        extendList.forEach(extend => {
          let extendMatchs = extend.match(new RegExp(EXTEND_PATERN));
          if(extendMatchs){
            let name = `extend_${extendMatchs[1]}`
            let val = extendMatchs[2]
            if (val.match(QUOTES_PATTERN)) {
              val = val.replace(QUOTES_REPLACE, '');
            }
            extendFields[name] = val
          }
        })
      }

    }

    return { name, value, ...extendFields } as IDeclaration;
  }
  private parseMapDeclarations(parsedDeclaration: IDeclaration) {
    let map = this.extractMapDeclarations(parsedDeclaration.value);

    if (map.length) {
      parsedDeclaration.mapValue = map.map((declaration) => {
        if(this.checkIsAnnotation(declaration)){
          declaration = declaration.replace(/(,)(?=\s*(\/\*|\/\/))/, ';');
        }
        const singleDeclaration = this.parseSingleDeclaration(
          `$${declaration};`
        );
        this.parseMapDeclarations(singleDeclaration);

        return singleDeclaration;
      });
    }
  }
  private checkIsSectionStart(content: string): boolean {
    return (new RegExp(SECTION_PATTERN, 'gi')).test(content);
  }


  private checkIsSectionEnd(content: string): boolean {
    return (new RegExp(END_SECTION_PATTERN, 'gi')).test(content);
  }

  private checkIsAnnotation(content: string): boolean {
    return (new RegExp(ANNOTATION_PATERN, 'gi')).test(content);
  }
}
