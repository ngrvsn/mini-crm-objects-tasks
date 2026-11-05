"""Build the one-page, nontechnical CRM handout and its public download copy."""

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "mini-crm-guide.pdf"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

font_pairs = [
    (Path(r"C:\Windows\Fonts\arial.ttf"), Path(r"C:\Windows\Fonts\arialbd.ttf")),
    (
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    ),
]
regular_font, bold_font = next(
    ((regular, bold) for regular, bold in font_pairs if regular.exists() and bold.exists()),
    (None, None),
)
if regular_font is None or bold_font is None:
    raise RuntimeError("Install Arial or DejaVu Sans to generate the PDF")
pdfmetrics.registerFont(TTFont("Arial", str(regular_font)))
pdfmetrics.registerFont(TTFont("Arial-Bold", str(bold_font)))
pdfmetrics.registerFontFamily("Arial", normal="Arial", bold="Arial-Bold")

navy = colors.HexColor("#183b62")
blue = colors.HexColor("#2869ad")
muted = colors.HexColor("#50667d")
soft = colors.HexColor("#eaf2fb")
green = colors.HexColor("#e9f5ee")

title = ParagraphStyle(
    "title", fontName="Arial-Bold", fontSize=20, leading=24, textColor=navy
)
subtitle = ParagraphStyle(
    "subtitle", fontName="Arial", fontSize=10, leading=15, textColor=muted
)
section = ParagraphStyle(
    "section",
    fontName="Arial-Bold",
    fontSize=11.5,
    leading=15,
    textColor=navy,
    spaceBefore=13,
    spaceAfter=5,
)
body = ParagraphStyle(
    "body", fontName="Arial", fontSize=9.4, leading=14, textColor=navy
)
small = ParagraphStyle(
    "small", fontName="Arial", fontSize=8.5, leading=12.5, textColor=muted
)
flow = ParagraphStyle(
    "flow",
    fontName="Arial-Bold",
    fontSize=9.1,
    leading=13,
    textColor=navy,
    alignment=TA_CENTER,
)


def para(text: str, style=body) -> Paragraph:
    return Paragraph(text, style)


story = [
    para("Мини-CRM: объекты и задачи", title),
    Spacer(1, 3 * mm),
    para("Памятка для руководителя · демонстрационный стенд", subtitle),
    Spacer(1, 5 * mm),
    HRFlowable(width="100%", thickness=1, color=blue),
    para("Что делает система", section),
    para(
        "Постановщик ведёт список объектов, создаёт задачи и назначает исполнителей. "
        "Исполнитель видит свою работу, отмечает её выполнение и передаёт на проверку. "
        "Постановщик принимает результат или возвращает задачу с пояснением, что исправить."
    ),
    para("Путь задачи", section),
]

status_cells = [
    para("Новая", flow),
    para("В работе", flow),
    para("На проверке", flow),
    para("Принята", flow),
]
status_table = Table([status_cells], colWidths=[30 * mm, 35 * mm, 43 * mm, 30 * mm])
status_table.setStyle(
    TableStyle(
        [
            ("BACKGROUND", (0, 0), (-1, -1), soft),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#c9d9eb")),
            ("LINEBEFORE", (1, 0), (-1, -1), 1, colors.white),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ]
    )
)
story.extend(
    [
        status_table,
        Spacer(1, 2 * mm),
        para(
            "Если результат нужно исправить, задача переходит в «На доработке» "
            "с обязательным комментарием, затем снова в работу.",
            small,
        ),
        para("Что видит и может исполнитель", section),
        para(
            "Только назначенные ему задачи и объекты с такими задачами. Он не может "
            "открыть чужую задачу, создать объект, назначить работу, принять свой "
            "результат, изменить чужие данные или историю действий. Эти ограничения "
            "проверяются самой системой, даже если отправить запрос в обход экрана."
        ),
        para("Как сохраняются данные", section),
        para(
            "У каждого сотрудника свой вход. История статусов показывает, кто и когда "
            "менял состояние задачи. После «Принята» задача закрыта для редактирования. "
            "Удалённая задача исчезает из рабочих списков, но её история остаётся."
        ),
        Spacer(1, 5 * mm),
    ]
)

link = para(
    '<b>Открыть стенд:</b> <link href="https://120nmine.tech/crm" '
    'color="#2869ad">https://120nmine.tech/crm</link>. '
    "Внутри есть кнопка «Инструкция» с отдельными шагами для каждой роли.",
    body,
)
link_box = Table([[link]], colWidths=[160 * mm])
link_box.setStyle(
    TableStyle(
        [
            ("BACKGROUND", (0, 0), (-1, -1), green),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#c8dfcf")),
            ("LEFTPADDING", (0, 0), (-1, -1), 12),
            ("RIGHTPADDING", (0, 0), (-1, -1), 12),
            ("TOPPADDING", (0, 0), (-1, -1), 10),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ]
    )
)
story.append(KeepTogether(link_box))


def footer(canvas, document):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#d4dfeb"))
    canvas.line(25 * mm, 19 * mm, 185 * mm, 19 * mm)
    canvas.setFont("Arial", 8)
    canvas.setFillColor(muted)
    canvas.drawString(25 * mm, 13 * mm, "Мини-CRM · инструкция для демонстрации")
    canvas.drawRightString(185 * mm, 13 * mm, str(document.page))
    canvas.restoreState()


document = SimpleDocTemplate(
    str(OUTPUT),
    pagesize=A4,
    leftMargin=25 * mm,
    rightMargin=25 * mm,
    topMargin=23 * mm,
    bottomMargin=25 * mm,
    title="Мини-CRM: памятка для руководителя",
    author="Мини-CRM",
)
document.build(story, onFirstPage=footer, onLaterPages=footer)
print(OUTPUT)
