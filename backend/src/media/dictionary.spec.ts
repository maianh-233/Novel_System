import { parseCommonsAudio, parseDictionary } from './dictionary.js';

const media = (f: string) =>
  `https://api.dictionaryapi.dev/media/pronunciations/en/${f}`;

const BUTTERFLY = [
  {
    word: 'butterfly',
    phonetic: '/ˈbʌtə(ɹ)flaɪ/',
    phonetics: [
      {
        text: '/ˈbʌtə(ɹ)flaɪ/',
        audio: media('butterfly-au.mp3'),
        sourceUrl: 'https://commons.wikimedia.org/w/index.php?curid=75729193',
        license: { name: 'BY-SA 4.0' },
      },
      {
        text: '[ˈbʌɾɚflaɪ]',
        audio: media('butterfly-us.mp3'),
        sourceUrl: 'https://commons.wikimedia.org/w/index.php?curid=788376',
        license: { name: 'BY 2.5' },
      },
      { text: '[ˈbʌtəflaɪ]', audio: media('butterfly-uk.mp3') },
      { text: '[ˈbʌɾɚflaɪ]', audio: '' },
    ],
    meanings: [
      {
        definitions: [
          { definition: 'An insect.' },
          { definition: 'Tape.', example: 'butterfly tape' },
          {
            definition: 'An insect.',
            example: 'A yellow butterfly sat on the flower.',
          },
          {
            definition: 'Feeling.',
            example:
              'I get terrible butterflies before I go on stage, and they last a really long time — sometimes for the whole show, which is far too long for an example sentence.',
          },
        ],
      },
    ],
  },
];

const EMPTY = {
  ipa: null,
  example: null,
  audioSourceUrl: null,
  commonsPageId: null,
  audioCredit: null,
};

describe('parseDictionary', () => {
  it('ưu tiên giọng Mỹ, IPA đổi [..] về /../, lấy mã file Commons, ghi nguồn kèm giấy phép', () => {
    expect(parseDictionary('butterfly', BUTTERFLY)).toEqual({
      ipa: '/ˈbʌɾɚflaɪ/',
      example: 'A yellow butterfly sat on the flower.',
      audioSourceUrl: media('butterfly-us.mp3'),
      commonsPageId: '788376',
      audioCredit: 'Wiktionary (CC BY 2.5)',
    });
  });

  it('bỏ cụm từ, câu quá dài, câu không chứa đúng từ — chỉ nhận câu hoàn chỉnh', () => {
    const data = structuredClone(BUTTERFLY);
    data[0].meanings[0].definitions[2].example = 'A yellow moth sat there.';
    expect(parseDictionary('butterfly', data).example).toBeNull();
    for (const ex of [
      'city desk',
      'butterfly tape.',
      'the butterfly is red.',
    ]) {
      const d = structuredClone(BUTTERFLY);
      d[0].meanings[0].definitions = [{ definition: 'x', example: ex }];
      expect(parseDictionary('butterfly', d).example).toBeNull();
    }
  });

  it('không tải âm thanh từ máy chủ lạ, không nhận mã Commons sai dạng', () => {
    const data = [
      {
        word: 'cat',
        phonetics: [
          {
            text: '/kæt/',
            audio: 'https://evil.example/cat-us.mp3',
            sourceUrl: 'https://commons.wikimedia.org/?curid=1',
          },
          {
            text: '/kæt/',
            audio: media('cat-uk.mp3'),
            sourceUrl: 'https://evil.example/?curid=2',
          },
        ],
      },
    ];
    expect(parseDictionary('cat', data)).toMatchObject({
      ipa: '/kæt/',
      audioSourceUrl: media('cat-uk.mp3'),
      commonsPageId: null,
    });
  });

  it('dữ liệu rỗng hoặc sai dạng → toàn null', () => {
    for (const data of [null, {}, [], [{}]]) {
      expect(parseDictionary('cat', data)).toEqual(EMPTY);
    }
  });
});

describe('parseCommonsAudio', () => {
  const page = (videoinfo: unknown) => ({
    query: { pages: { '1': { videoinfo } } },
  });

  it('ưu tiên bản MP3 Commons chuyển sẵn (iPad phát được)', () => {
    expect(
      parseCommonsAudio(
        page([
          {
            url: 'https://upload.wikimedia.org/a/En-us-cat.ogg',
            derivatives: [
              {
                src: 'https://upload.wikimedia.org/t/x.ogg',
                type: 'audio/ogg',
              },
              {
                src: 'https://upload.wikimedia.org/t/x.mp3',
                type: 'audio/mpeg',
              },
            ],
          },
        ]),
      ),
    ).toBe('https://upload.wikimedia.org/t/x.mp3');
  });

  it('không có MP3 thì dùng file gốc; link ngoài Wikimedia bị bỏ', () => {
    expect(
      parseCommonsAudio(
        page([{ url: 'https://upload.wikimedia.org/a/x.ogg' }]),
      ),
    ).toBe('https://upload.wikimedia.org/a/x.ogg');
    expect(
      parseCommonsAudio(page([{ url: 'https://evil.example/x.ogg' }])),
    ).toBeNull();
    expect(parseCommonsAudio(null)).toBeNull();
  });
});
