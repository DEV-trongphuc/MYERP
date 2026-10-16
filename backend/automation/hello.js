let showform = null;
let comparePopup = null;
let renderAlert = null;
let renderMedia = null;
const IDEAS_DATA = {
    year_count: 14,
    students_count: 2502,
    courses_count: 74,
    teachers_count: 28,
    facebook_link: "https://www.facebook.com/ideas.edu.vn/",
    youtube_link: "https://www.youtube.com/c/Vi%E1%BB%87nIDEAS",
    zalo_link: "https://zalo.me/3857867121882640296",
    linkedin_link: "https://www.linkedin.com/company/ideasinstitute/",
    tiktok_link: "https://www.tiktok.com/@ideas_institute",
    programmes: {
        IDEAS01: {
            benefits: [
                "Chương trình học tập ưu việt, online linh hoạt cho người bận rộn, kiến thức có giá trị thực tiễn.",
                "Viện IDEAS hỗ trợ: hệ thống IDEAS – LMS & lớp chuyên đề bổ trợ vào các ngày Chủ nhật, có hướng dẫn bài tập và đánh giá sơ bộ bài Final exam.",
                "Chuyến đi dự lễ tốt nghiệp và nhận bằng tại trụ ở chính của trường – Paris Pháp, kết hợp cùng với chuyến tham quan các thành phố thủ đô lớn ở Châu Âu: Thụy Sĩ – Pháp – Bỉ – Hà Lan (các nước trong cùng 1 chuyến đi).",
                "Chính sách hỗ trợ học phí linh hoạt cùng với các học bổng của trường Ascencia và quỹ học bổng từ Viện IDEAS.",
            ],
            program_name_degree: "Global MBA",
            program_benefits_degree: [
                "Tấm bằng MBA danh giá được trao từ một trường kinh doanh lớn, danh tiếng và campus trãi dài rộng khắp thế giới.",
                "Là cựu học viên của trường Ascencia Business School đánh dấu cột mốc quan trọng trên con đường phát triển.",
                "Chính thức trở thành chuyên gia – phát triển các kỹ năng lãnh đạo cần thiết để thúc đẩy sự thay đổi tích cực trong lĩnh vực của bạn.",
            ],
            link_iframe:
                "https://www.youtube.com/embed/Dc78ClToNRo?si=AO4hu9oSz7OoGbxd",
            listImgs: [
                "https://ideas.edu.vn/wp-content/uploads/2025/07/ltn7_2025-12.webp",
                "https://ideas.edu.vn/wp-content/uploads/2025/07/126.webp",
                "https://ideas.edu.vn/wp-content/uploads/2025/07/128.webp",
                "https://ideas.edu.vn/wp-content/uploads/2025/07/130.webp",
                "https://ideas.edu.vn/wp-content/uploads/2025/07/128.webp",
                "https://ideas.edu.vn/wp-content/uploads/2024/06/asc17-6-2.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2024/06/asc17-6-4.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2024/04/NHP_1903-1-1.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2024/11/8X1A9328-1-1.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/03/8X1A8537.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/03/8X1A8638.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/03/8X1A8725.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/03/8X1A8841.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/03/8X1A9322.jpg",
            ],
            level: "MBA",
            avatar:
                "https://ideas.edu.vn/wp-content/uploads/2025/09/global-mba-1.png.webp",
            name: "Global MBA",
            highlight: [
                "Trực tuyến 100%",
                "MBA",
                "Linh hoạt trên Platform của trường",
                "2 buổi chuyên đề/môn (Chủ nhật)",
            ],
            school: "Ascencia Business School",
            country: "Pháp",
            subjects: "<b>75</b> tín chỉ ECTS - <b>12</b> môn và Capstone",
            duration: "14-16 tháng",
            tagline: "Là trường thành viên của tổ chức giáo dục College de Paris",
            link: "/ascencia-global-mba",
            experience: [
                "Tốt nghiệp cử nhân",
                "Tối thiểu 2 năm kinh nghiệm ở cấp độ quản lý",
                "Tiếng Anh giao tiếp tốt hoặc bằng cấp tương đương IELTS 6.0",
            ],
            test: {
                high: [
                    "Chương trình học tập, làm bài và nộp trên platform của trường, dựa trên tài liệu và hướng dẫn của Giáo sư.",
                    "Thời gian học tập tự sắp xếp linh hoạt, hỗ trợ bởi các giảng viên Việt Nam trong quá trình học.",
                    "Học phí linh hoạt chia nhỏ hoặc trả góp.",
                ],
            },
            fee_course: [
                // {
                //   name: "Standard",
                //   icon: "https://ideas.edu.vn/wp-content/new_public/data_imgs/icon6.png",
                //   price: "2.800 Euro",
                //   benefits: [
                //     "Tài khoản truy cập tài liệu học tập, môn học theo chương trình gốc của trường.",
                //     "Hệ thống LMS lưu trữ record các lớp chuyên đề của môn học được Enroll, lưu file PDF tài liệu môn học, hướng dẫn bài Final exam.",
                //     "Tham gia các buổi hướng dẫn tập trung của Viện đối với bài luận văn.",
                //     "Học viên có thể tham gia buổi hướng dẫn luận văn của Viện IDEAS và đăng ký hỗ trợ qua hệ thống LMS tích hợp I-AI. Ngoài ra, có thể tham gia lớp chuyên đề (2.5 ngày/môn) và đăng ký đánh giá sơ bộ bài Final với phí: 100 Euro/môn, 300 Euro/Capstone.",
                //   ],
                // },
                {
                    name: "High Quality",
                    icon: "https://ideas.edu.vn/wp-content/new_public/data_imgs/icon5.png",
                    price: "7.000 Euro",
                    benefits: [
                        "Bao gồm chương trình Standard",
                        "Hệ thống LMS: ứng dụng I-AI để hỗ trợ trong quá trình học tập.",
                        "Trợ lý chương trình nhắc deadline, hỗ trợ hệ thống, kết nối giảng viên qua Group Zalo/Email.",
                        "Lớp chuyên đề: mỗi môn sẽ có 2,5 ngày Chủ nhật, được hướng dẫn bởi các Giảng viên của Viện IDEAS.",
                        "Đánh giá sơ bộ bài Final: Được hội đồng chuyên môn của Viện IDEAS đánh giá, góp ý bài Final đã đi đúng hướng, tránh lạc đề, học viên nắm được điểm đánh giá sơ bộ và hạn chế được khả năng rớt môn.",
                    ],
                },
            ],

            description:
                "Global MBA là một trong những chương trình nổi bật của Ascencia Business School, được thiết kế để phù hợp với những người muốn nâng cao kiến thức và kỹ năng quản lý quốc tế, phát triển sự nghiệp toàn cầu và mở rộng mạng lưới quan hệ.",
            demographic: {
                jobs: [
                    {
                        jobname: "Quản trị kinh doanh",
                        percent: 30,
                    },
                    {
                        jobname: "Ngân hàng",
                        percent: 22,
                    },
                    {
                        jobname: "Công nghệ thông tin",
                        percent: 20,
                    },
                    {
                        jobname: "Start-up",
                        percent: 16,
                    },
                    {
                        jobname: "Khác",
                        percent: 12,
                    },
                ],
                ages: [
                    {
                        jobname: "18 - 24",
                        percent: 7,
                    },
                    {
                        jobname: "25 - 30",
                        percent: 27,
                    },
                    {
                        jobname: "31 - 40",
                        percent: 55,
                    },
                    {
                        jobname: "41 - 50",
                        percent: 10,
                    },
                    {
                        jobname: "51+",
                        percent: 1,
                    },
                ],
            },
            degree: {
                front:
                    "https://ideas.edu.vn/wp-content/uploads/2024/11/MBA-Ascencia-Diploma-EN-MOFA-1.webp",
                back: "https://ideas.edu.vn/wp-content/uploads/2024/11/MBA-Ascencia-Diploma-EN-MOFA-2.webp",
            },
            accreditation: [
                {
                    name: "Công nhận và Kiểm định",
                    logo: "https://www.collegedeparis.fr/wp-content/uploads/2021/07/qualiopirogne.png",
                    link: "#",
                },
                {
                    name: "Công nhận và Kiểm định",
                    logo: "https://www.collegedeparis.fr/wp-content/uploads/2021/06/fcomp-logo-site.png",
                    link: "#",
                },
                {
                    name: "Công nhận và Kiểm định",
                    logo: "https://www.collegedeparis.fr/wp-content/uploads/2021/06/fle-logo-site.png",
                    link: "#",
                },

                {
                    name: "Công nhận và Kiểm định",
                    logo: "https://www.collegedeparis.fr/wp-content/uploads/2021/06/erasmus-logo-site.png",
                    link: "#",
                },
                {
                    name: "Công nhận và Kiểm định",
                    logo: "https://www.collegedeparis.fr/wp-content/uploads/2021/06/fcomp-logo-site.png",
                    link: "#",
                },
                {
                    name: "Công nhận và Kiểm định",
                    logo: "https://www.collegedeparis.fr/wp-content/uploads/2021/06/bpi-logosite.png",
                    link: "#",
                },
                {
                    name: "Công nhận và Kiểm định",
                    logo: "https://ideas.edu.vn/wp-content/uploads/2023/12/vnanric.jpg",
                    link: "#",
                },
            ],
            require: [
                "Bằng cử nhân và bảng điểm",
                "Sơ yếu lí lịch (CV)",
                "Thư động lực (Motivation Letter)",
                "Ảnh hộ chiếu (4×6)",
                "Passport",
                "Tiếng anh tương đương IELTS 6.0 hoặc có thể phỏng vấn đầu vào với đại diện của trường tại Việt Nam",
                "Application Form <a href='https://ideas.edu.vn/wp-content/uploads/2025/03/Application-Form-_-1.pdf' target='_blank' class='text_download'>(Download Here)</a>",
            ],
            faq: [
                {
                    q: "Tiếng anh nghe nói chưa tốt có thể theo học chương trình không?",
                    a: "Có. Chương trình không yêu cầu học viên phải giỏi tiếng Anh giao tiếp, vì phần lớn nội dung học tập là đọc tài liệu, làm bài tập và viết luận. Tuy nhiên, học viên cần có khả năng đọc hiểu tiếng Anh ở mức khá để theo kịp chương trình. Ngoài ra, các lớp chuyên đề của Viện IDEAS chủ yếu chia sẻ bằng Tiếng việt sẽ hỗ trợ học viên nắm được bài tốt hơn.",
                },
                {
                    q: "Nếu bận đi công tác không thể hoàn thành bài đúng hạn thì sao",
                    a: "Chương trình Global MBA của Ascencia Business School được thiết kế linh hoạt để phù hợp với lịch trình bận rộn của học viên. Mỗi môn học đều có thời gian bài tập kéo dài 8 tuần và bài tập phân bổ giãn cách mỗi tuần. Deadline các bài tập thường vào lúc 16h Việt Nam. Học viên nắm được thông tin bài tập và deadline sẽ sắp xếp phù hợp. Trường hợp Học viên chưa thể hoàn thành đúng thời hạn sẽ được đăng ký <b>Resubmit</b> có tốn phí để được mở thêm 1 tuần nộp lại bài.",
                },
                {
                    q: "Học viên có thể tham gia lễ tốt nghiệp tại Paris - Pháp không?",
                    a: "Có. Học viên hoàn thành chương trình có thể đăng ký tham gia lễ tốt nghiệp tại Pháp, cùng với các học viên quốc tế khác của Ascencia Business School. Mỗi năm có 2 đợt Lễ Tốt nghiệp vào tháng 6 và tháng 12. Viện IDEAS sẽ thông báo đến học viên về lịch thông báo từ Trường để học viên đăng kí.",
                },
            ],
            this_subjects: [
                {
                    name: "7SMG01. Strategic Management, Competitiveness & Globalization",
                    description:
                        "Học cách xây dựng chiến lược marketing, định vị thương hiệu, nghiên cứu thị trường và quản lý khách hàng",
                    link: "",
                    credit: 5,
                },
                {
                    name: "7BSU01. Business Sustainability, Ethics and Social Responsibility",
                    description:
                        "Nâng cao kỹ năng quản lý nhân sự và phát triển tài năng trong tổ chức, giúp tối ưu hóa nguồn nhân lực",
                    link: "",
                    credit: 5,
                },
                {
                    name: "7BIS02. Managing a Contemporary Business Information System",
                    description:
                        "Khám phá các nguyên tắc khởi nghiệp và đổi mới sáng tạo để phát triển doanh nghiệp thành công",
                    link: "",
                    credit: 5,
                },
                {
                    name: "7FMG01. Financial Management Theory and Practice",
                    description:
                        "Nắm vững kiến thức tài chính doanh nghiệp, tối ưu hóa dòng tiền và chiến lược tài chính",
                    link: "",
                    credit: 5,
                },
                {
                    name: "7SCM01. Operations, Supply Chain and Project Management",
                    description:
                        "Cung cấp các nguyên tắc kế toán quan trọng giúp nhà quản lý đưa ra quyết định kinh doanh hiệu quả",
                    link: "",
                    credit: 5,
                },
                {
                    name: "7MTI02. The Management of Technology and Innovation",
                    description:
                        "Khám phá cách công nghệ số đang thay đổi mô hình kinh doanh và phương pháp quản lý",
                    link: "",
                    credit: 5,
                },
                {
                    name: "7MST01. Marketing Strategy",
                    description:
                        "Phát triển chiến lược kinh doanh toàn cầu, giúp doanh nghiệp mở rộng và cạnh tranh hiệu quả",
                    link: "",
                    credit: 5,
                },
                {
                    name: "7BAN02. Business Analytics, Data Analysis & Decision Making",
                    description:
                        "Học cách lập kế hoạch, thực hiện và kiểm soát dự án để đạt được mục tiêu kinh doanh",
                    link: "",
                    credit: 5,
                },
                {
                    name: "7HRM01. Strategic Human Resources Management",
                    description:
                        "Nghiên cứu hành vi tổ chức để cải thiện hiệu suất và môi trường làm việc",
                    link: "",
                    credit: 5,
                },
                {
                    name: "7MOD01. Managing Organizational Diversity",
                    description:
                        "Phát triển kỹ năng lãnh đạo để điều hành tổ chức một cách hiệu quả và truyền cảm hứng cho đội ngũ",
                    link: "",
                    credit: 5,
                },
                {
                    name: "7ELE01. Executive Leadership",
                    description:
                        "Hướng dẫn phương pháp nghiên cứu và viết luận văn thạc sĩ chuyên sâu",
                    link: "",
                    credit: 5,
                },
                {
                    name: "7MEC01. Managerial Economics",
                    description:
                        "Trang bị kỹ năng đàm phán kinh doanh để đạt được thỏa thuận có lợi nhất",
                    link: "",
                    credit: 5,
                },
                {
                    name: "CAP. Capstone Project",
                    description:
                        "Hoàn thành luận văn MBA dựa trên nghiên cứu thực tế và ứng dụng kiến thức học được",
                    link: "",
                    credit: 15,
                },
            ],
        },
        IDEAS02: {
            benefits: [
                "Bắt buộc các lớp học tương tác trực tuyến với giảng viên nước ngoài. Nâng cao khả năng, tự tin giao tiếp, trao đổi với Giáo sư và giải quyết các vấn đề thực tiễn trong doanh nghiệp.",
                "Công nghệ chatbox I-AI hỗ trợ các nội dung phù hợp trong chương trình MBA online do Viện IDEAS quản lý. Trợ lý chương trình hỗ trợ nhắc nhở deadline bài tập, các vấn đề liên quan đến hệ thống, kết nối.",
                "Viện IDEAS hỗ trợ: hệ thống IDEAS - LMS & lớp chuyên đề bổ trợ vào các ngày Chủ nhật, có hướng dẫn bài tập và đánh giá sơ bộ bài Final exam.",
                "Lễ tốt nghiệp và chuyến đi học tập tại trụ sở chính của trường - Geneva Thụy Sĩ.",
            ],
            program_name_degree: "Master of Business Administration",
            program_benefits_degree: [
                "Tấm bằng Thạc sĩ danh giá được trao từ một trường đại học lâu đời và danh tiếng.",
                "Là cựu học viên của trường Swiss UMEF, tân Thạc Sĩ đánh dấu cột mốc quan trọng trên con đường phát triển.",
                "Chính thức trở thành chuyên gia - phát triển các kỹ năng lãnh đạo cần thiết để thúc đẩy sự thay đổi tích cực trong lĩnh vực của bạn.",
            ],
            link_iframe:
                "https://www.youtube.com/embed/ZrLeuFGGXQI?si=o8eCXmmewBzKvCgT",
            listImgs: [
                "https://ideas.edu.vn/wp-content/uploads/2025/11/ltnumef10202501.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/11/DSC_9177.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/11/DSCF6555.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/11/DSCF6740.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/11/DSCF6777.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/03/NHP_4768.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/03/NHP_4712.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/03/NHP_4367.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/03/NHP_4528.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/03/NHP_4783.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/03/NHP_4447.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/03/NHP_4356.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/03/NHP_4861.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/03/NHP_4840.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/03/NHP_4799.jpg",
            ],
            level: "MBA",
            avatar:
                "https://ideas.edu.vn/wp-content/uploads/2025/09/online-mba-1.png.webp",
            name: "Online MBA",
            school: "Swiss UMEF",
            subjects: "<b>90</b> tín chỉ ECTS - <b>12</b> môn và luận văn",
            duration: "18 tháng",
            country: "Thuỵ Sĩ",
            experience: [
                "Tốt nghiệp cử nhân",
                "Tối thiểu 3 năm kinh nghiệm làm việc",
                "Tiếng Anh giao tiếp tốt hoặc bằng cấp tương đương IELTS 6.0",
            ],
            test: {
                high: [
                    "Lớp học tương tác trực tiếp, được trao đổi và thảo luận cùng Giảng viên và học viên",
                    "Kiến thức quản trị chuyên sâu, kết hợp với case study thực tiễn",
                    "Lộ trình học lên DBA với nhiều học bỗng từ trường và Viện IDEAS",
                    "Học phí linh hoạt chia nhỏ hoặc trả góp",
                ],
                stand: [
                    "Thời gian học tập, nghiên cứu tự sắp xếp linh hoạt, hỗ trợ bởi các giảng viên Việt Nam trong quá trình học",
                    "Kiến thức quản trị chuyên sâu, kết hợp với case study thực tiễn",
                    "Lộ trình học lên DBA với nhiều học bỗng từ trường và Viện IDEAS",
                    "Học phí linh hoạt chia nhỏ hoặc trả góp",
                ],
            },
            highlight: [
                "Trực tuyến 100%",
                "Thạc sĩ (Master)",
                "20:00 - 23:00 (Vietnam)",
                "2 buổi chuyên đề/môn (Chủ nhật)",
            ],
            tagline:
                "Đại học tư thục đầu tiên tại Geneva đạt kiểm định liên bang cao nhất Thuỵ Sĩ - Swiss Accreditation Council",
            link: "/swiss-umef-online-mba",
            description:
                "Chương trình MBA Online phù hợp cho người bận rộn. Bằng cấp được công nhận bởi Hội đồng Kiểm định Liên bang Thụy Sĩ, đảm bảo giá trị quốc tế, mang đến kiến thức thực tiễn và cập nhật theo xu hướng kinh doanh toàn cầu.",
            demographic: {
                jobs: [
                    {
                        jobname: "Quản trị kinh doanh",
                        percent: 30,
                    },
                    {
                        jobname: "Ngân hàng",
                        percent: 22,
                    },
                    {
                        jobname: "Công nghệ thông tin",
                        percent: 20,
                    },
                    {
                        jobname: "Start-up",
                        percent: 16,
                    },
                    {
                        jobname: "Khác",
                        percent: 12,
                    },
                ],
                ages: [
                    {
                        jobname: "18 - 24",
                        percent: 7,
                    },
                    {
                        jobname: "25 - 30",
                        percent: 27,
                    },
                    {
                        jobname: "31 - 40",
                        percent: 55,
                    },
                    {
                        jobname: "41 - 50",
                        percent: 10,
                    },
                    {
                        jobname: "51+",
                        percent: 1,
                    },
                ],
            },

            degree: {
                back: "https://ideas.edu.vn/wp-content/uploads/2025/11/Sample_page-0002.webp",
                front:
                    "https://ideas.edu.vn/wp-content/uploads/2025/11/z7191978013846_36a81ec39301d05fedaf6d4cd0293f9c-1.webp",
                transcript:
                    "https://ideas.edu.vn/wp-content/uploads/2025/11/Sample_page-0003.webp",
            },
            fee_plane: "3,000",
            fee_course: [
                // {
                //   name: "Standard",
                //   icon: "https://ideas.edu.vn/wp-content/new_public/data_imgs/icon6.png",
                //   price: "2.900 CHF",
                //   benefits: [
                //     "<b>Dành cho học viên đăng ký từ 01/08/2025:</b> Trợ phí từ trường giảm <b>500 CHF</b>.",
                //     "Tài khoản truy cập tài liệu học tập, môn học theo chương trình gốc của trường.",
                //     "Trợ lý chương trình nhắc deadline, hỗ trợ hệ thống, kết nối giảng viên qua Group Zalo/Email.",
                //     "I-AI: Chatbot hỗ trợ nội dung và giải đáp thắc mắc (Viện IDEAS).",
                //     "Lớp chuyên đề của Viện IDEAS tổ chức 2 ngày Chủ nhật vào tuần thứ 2 và thứ 4 mỗi môn, từ 8h30 - 11h30 và 13h30 - 16h30, nhằm giúp kiểm tra và hướng dẫn hoàn thành bài Final Exam.",
                //   ],
                // },
                {
                    name: "High Quality",
                    icon: "https://ideas.edu.vn/wp-content/new_public/data_imgs/icon5.png",
                    price: "10.970 CHF",
                    // price_promo: "4.675 CHF",
                    benefits: [
                        "Chính sách ưu đãi 1.250 CHF áp dụng đến hết ngày 22/03/2026",
                        "Hỗ trợ trả góp 12 - 24 tháng qua Sacombank",
                        "Bao gồm chương trình Standard và Hệ thống học tập eAcademy.",
                        "Ứng dụng công nghệ - Platform Ai cho học tập do IDEAS phát triển",
                        "Lớp học GVNN vào các buổi tối trong tuần (tùy chọn)",
                        "Lịch học: mỗi môn học kéo dài 04 tuần, mỗi tuần có 02 buổi tối học với giảng viên nước ngoài của trường (lịch dự kiến rơi vào tối thứ 3 và tối thứ 5, mỗi buổi từ 2-3 tiếng, từ 20h00 - 22h00)",
                        "Đánh giá sơ bộ bài Final: Được hội đồng chuyên môn của Viện IDEAS đánh giá, góp ý bài Final đã đi đúng hướng, tránh lạc đề, học viên nắm được điểm đánh giá sơ bộ và hạn chế được khả năng rớt môn.",
                    ],
                },
            ],

            accreditation: [
                {
                    name: "Kiểm định trường UMEF",
                    logo: "https://ideas.edu.vn/wp-content/new_public/data_imgs/kdumef1.png",
                    link: "#",
                },
                {
                    name: "Kiểm định trường UMEF",
                    logo: "https://ideas.edu.vn/wp-content/new_public/data_imgs/kdumef3.png",
                    link: "#",
                },
                {
                    name: "Kiểm định trường UMEF",
                    logo: "https://ideas.edu.vn/wp-content/new_public/data_imgs/kdumef4.png",
                    link: "#",
                },
                {
                    name: "Kiểm định trường UMEF",
                    logo: "https://ideas.edu.vn/wp-content/new_public/data_imgs/kdumef5.png",
                    link: "#",
                },
                {
                    name: "Kiểm định trường UMEF",
                    logo: "https://ideas.edu.vn/wp-content/uploads/2023/12/vnanric.jpg",
                    link: "#",
                },
                {
                    name: "Kiểm định trường UMEF",
                    logo: "https://ideas.edu.vn/wp-content/new_public/data_imgs/kdumef2.png",
                    link: "#",
                },
            ],
            require: [
                "Bằng cử nhân và bảng điểm",
                "Sơ yếu lí lịch (CV)",
                "Thư động lực (Motivation Letter)",
                "Ảnh hộ chiếu (4×6)",
                "Passport",
                "Tiếng anh tương đương IELTS 6.0 hoặc có thể phỏng vấn đầu vào với đại diện của trường tại Việt Nam",
                "Admission Form <a href='https://ideas.edu.vn/wp-content/uploads/2025/03/ADMISSION-FORM_ENG_MBA-_UMEF.docx' target='_blank' class='text_download'>(Download Here)</a>",
            ],
            faq: [
                {
                    q: "Luận văn của chương trình MBA yêu cầu như thế nào",
                    a: "Đối với chương trình MBA của Swiss UMEF, học viên bắt buộc phải thực hiện luận văn tốt nghiệp để hoàn thành chương trình. Luận văn là một nghiên cứu chuyên sâu về một vấn đề quản trị thực tiễn, giúp học viên ứng dụng các kiến thức đã học vào giải quyết một vấn đề cụ thể trong doanh nghiệp hoặc ngành nghề của mình. <br/>  <br/> Học viên sẽ được Viện IDEAS hướng dẫn tập trung hoặc hướng dẫn 1-1 để xây dựng đề cương, thu thập dữ liệu, phân tích và trình bày kết quả. Luận văn cần tuân thủ các tiêu chuẩn học thuật về nội dung, hình thức và phương pháp nghiên cứu theo quy định của Swiss UMEF. Tối thiểu bài luận văn cần 20,000 từ, theo chuẩn APA format. Sau khi hoàn thành, luận văn sẽ được hội đồng thẩm định đánh giá.",
                },
                {
                    q: "Lễ tốt nghiệp sau khi hoàn thành Online MBA sẽ được tổ chức ở đâu, có thể qua Trường không?",
                    a: "Sau khi hoàn thành chương trình Online MBA, học viên sẽ được tham gia lễ tốt nghiệp do Swiss UMEF tổ chức. Thông thường, lễ tốt nghiệp sẽ diễn ra tại Geneva, Thụy Sĩ, nơi đặt trụ sở chính của Trường. Tuy nhiên, Swiss UMEF cũng có thể tổ chức buổi lễ tốt nghiệp tại Việt Nam hoặc các địa điểm khác tùy theo số lượng học viên và điều kiện tổ chức. Học viên có thể lựa chọn tham dự lễ tốt nghiệp tại Geneva hoặc tại địa điểm do Viện IDEAS phối hợp tổ chức.",
                },
                {
                    q: "Bằng MBA của Swiss UMEF có giá trị như thế nào?",
                    a: "Bằng MBA do Swiss UMEF (Thụy Sĩ) cấp, có giá trị quốc tế. Swiss UMEF là một trường đại học tư nhân đầu tiên tại Geneva có kiểm định Liên Bang và được công nhận tại nhiều quốc gia. Phù hợp với những người muốn nâng cao kiến thức quản trị, phát triển sự nghiệp ở môi trường quốc tế.",
                },
            ],
            this_subjects: [
                {
                    name: "MBA 400. Marketing Management",
                    description:
                        "This course progressively builds on marketing issues by exploring more advanced topics and strategic planning in the marketing concept. Our attention will be drawn to laying the groundwork by strategically planning all the marketing approaches and analyzing the external and internal environment of the organization. <br/><br/> This course also examines the dynamic environment inhabited by today's marketers, helping students understand the marketplace and integrate the appropriate information into marketing decisions. The course focuses on an integrated approach and strategy-based actions, covering only those critical and advanced issues required to succeed in future professional work. <br/><br/> Additionally, our focus includes the concept of marketing, the marketing manager's job, the development of a marketing strategy, marketing research, consumer behavior and analysis, organizational buying behavior; market structure and competitor analysis; marketing mix decision-making; communications and advertising strategy; channels of distribution; the personal sales channel; pricing; sales promotion; strategies for service markets; strategies for technology-based markets; global marketing strategies; and new product development",
                    link: "https://youtu.be/KQ6NgVvctXc?feature=shared",
                    credit: 6,
                },
                {
                    name: "MBA 401. Human Capital and Talent Management",
                    description:
                        "This course is designed to provide a fresh approach to management students, based on dynamic, real-life organizational events confronting both human resource managers and line managers who often implement personnel programs and policies. <br/><br/> Human Resource Management takes a managerial orientation and is viewed as being relevant to managers in every unit, project or team. Managers are constantly faced with human relation management issues, problems and decision making. <br/><br/>  This course will introduce management students to HR activities (recruitment and selection, training and development, reward management and performance appraisal) with the emphasis that it is the bundles of HR interventions and not single practices that develop effective human resources. Based on realistic, current trends confronting managers, this course will also expose the management students to contemporary issues, such as, employee engagement and organizational change, and how HR can work together with knowledge management, technology, internationalization - and talent management - to further develop the effectiveness of human resources and help create, develop and sustain a high-performing organization",
                    link: "https://youtu.be/16dkyS-LVes?feature=shared",
                    credit: 6,
                },
                {
                    name: "MBA 402. Entrepreneurship and Innovation",
                    description:
                        "This course explores the principles and practices of entrepreneurship and innovation. Students will learn how to identify and evaluate entrepreneurial opportunities, develop innovative ideas, and create viable business models. The course emphasizes critical thinking, creativity, and problem-solving skills necessary for successful entrepreneurship. Students will also gain an understanding of the challenges and strategies involved in launching and growing a new venture in a dynamic business environment",
                    link: "",
                    credit: 6,
                },
                {
                    name: "MBA 403. Corporate Finance",
                    description:
                        "This course systematically unfolds crucial issues in corporate finance management at graduate level. We review the introductory aspect of the course, and build from there toward approaches of investment appraisals, explaining details as regards the methods like compound interest, net present value decision rule and the internal rate of return. Additionally, methods such as the annuities and perpetuities, sinking fund and discounted cash flows and tax payments would be fully discussed. <br/><br/> Issues in capital rationing and risk analysis are discussed under certain market conditions, considering the constraint, sensitivity analysis. <br/><br/> Our study efforts will also consider portfolio theory and capital asset pricing model, which is an important aspect of corporate financial management, together with the capital budgeting model and the associated specific tools used in portfolio theory and pricing decision. <br/><br/> Other topics such as market share value and pricing would be examined to give students advanced knowledge of the company‘s worth. We further go on to dividend decision, which is the crux of cash management concern, as against retained earning for futures operations and the rule of safety thumps",
                    link: "https://youtu.be/wRYf2ZcaeJY?feature=shared",
                    credit: 6,
                },
                {
                    name: "MBA 404. Accounting for Managers",
                    description:
                        "This course is designed to provide students with an understanding of the interplay between politics, economics, and geography in shaping international relations. Students will learn about the key concepts and theories of geopolitics and geoeconomics, as well as their practical applications in contemporary world affairs",
                    link: "https://youtu.be/daYqOgjHw94?feature=shared",
                    credit: 6,
                },
                {
                    name: "MBA 405. Digital Transformation",
                    description:
                        "The course will deepen the student’s comprehension of the digital transformation that is pervading society. The course will examine the process that contributes to the transitions to a digital society and economy. Therefore, digitalization is having an impact on different levels, affecting structures and the strategies of the organization, their ability to respond to external stimuli, the interactions with the stakeholders and the definition of the value proposition. Hence, the Digital transformation course aims also to support the students to understand the problems that the digital transformation might arise and, at the same time, to assess the new opportunities that the digitalization produces",
                    link: "",
                    credit: 6,
                },
                {
                    name: "MBA 406. Strategy Management",
                    description:
                        "This course introduces the key concepts, tools, and principles of strategy formulation and competitive analysis. It is concerned with managerial decisions and actions that affect the performance and survival of business enterprises. The course is focused on the information, analyses, organizational processes, and skills and business judgment managers must use to devise strategies, position their businesses, define firm boundaries and maximize long-term profits in the face of uncertainty and competition.  The course takes a general management perspective, viewing the firm as a whole, and examining how policies in each functional area are integrated into an overall competitive strategy. The key strategic business decisions of concern in this course involve choosing competitive strategies, creating competitive advantages, taking advantage of external opportunities, securing and defending sustainable market positions, and allocating critical resources over long periods. Decisions such as these can only be made effectively by viewing a firm holistically, and over the long term",
                    link: "",
                    credit: 6,
                },
                {
                    name: "MBA 407. Project Management",
                    description:
                        "Project management is a key contributor to organizational success and business results. This course teaches the fundamentals of project management. Students will learn how to select projects (portfolio management), lead and manage projects, build project teams, handle project risks, manage costs and schedules, control project progress, terminate projects, and integrate sustainability considerations throughout the project life cycle",
                    link: "",
                    credit: 6,
                },
                {
                    name: "MBA 408. Organizational Behaviour",
                    description:
                        "This course provides a comprehensive understanding of supply chain management, covering the key concepts, strategies, and practices involved in managing the flow of goods and services from suppliers to end customers. Students will explore various aspects of supply chain management, including procurement, logistics, inventory management, demand forecasting, and supplier relationships. The course aims to develop students' skills in designing, optimizing, and coordinating supply chain activities to achieve competitive advantage and operational excellence",
                    link: "",
                    credit: 6,
                },
                {
                    name: "MBA 409. Leadership Development",
                    description:
                        "This course approaches the Cross-Cultural Leadership from an organisational perspective, where individuals from different cultures, religions, and educational backgrounds interact on a daily basis. The organisation, where decisions are made collectively, promote people interactions and responsibilities incorporating the sense of importance of multiculturalism into its strategic vision. <br/><br/>  This course aims to develop an easily applied and solid rule to identify cross-cultural differences within the organisation that can create robust boundaries and link them to the effective attainment of group goals. At the same time, the course observes real-life cases where meaningful differences exist but address appropriately through leadership of cultural diversity",
                    link: "https://youtu.be/KK9lDNHYGo4",
                    credit: 6,
                },
                {
                    name: "MBA 500. Thesis Methodology",
                    description:
                        "This course aims to build the student’s critical ability to independently undertake and write a thesis which is comprehensive independent work. It explains how to choose a subject, to gather the documentation, to write the plan of work and the plan of writing, how to read books that student will use, how to quote, to write footnotes, the table of content, the bibliography and, in the end, how to prepare the defense. It also helps the student to examine written reports and investigations within the field of social science, from a critical and scientific point of view. ",
                    link: "",
                    credit: 6,
                },
                {
                    name: "MBA 501. Business Negotiation/AI in Business Decision Making",
                    description:
                        "Standard: AI in Business Decision Making  <br/> High Quality: Business Negotiation",
                    link: "",
                    credit: 6,
                },
                {
                    name: "MBA 505. MBA Thesis",
                    description:
                        "Complete an MBA thesis based on practical research and application of the knowledge learned",
                    link: "",
                    credit: 18,
                },
            ],
        },
        IDEAS03: {
            benefits: [
                "Các lớp học tương tác trực tuyến với giảng viên nước ngoài. Nâng cao khả năng, tự tin giao tiếp, trao đổi với Giáo sư và giải quyết các vấn đề thực tiễn trong doanh nghiệp.",
                "Công nghệ chatbox I-AI hỗ trợ các nội dung phù hợp trong chương trình MBA online do Viện IDEAS quản lý. Trợ lý chương trình hỗ trợ nhắc nhở deadline bài tập, các vấn đề liên quan đến hệ thống, kết nối.",
                "Viện IDEAS hỗ trợ: hệ thống IDEAS – LMS & lớp chuyên đề bổ trợ vào các ngày Chủ nhật, có hướng dẫn bài tập và đánh giá sơ bộ bài Final exam.",
                "Lễ tốt nghiệp và chuyến đi học tập tại trụ sở chính của trường – Geneva Thụy Sĩ.",
            ],
            program_name_degree: "Executive Master of Business Administration",
            program_benefits_degree: [
                "Tấm bằng Thạc sĩ danh giá được trao từ một trường đại học lâu đời và danh tiếng.",
                "Là cựu học viên của trường Swiss UMEF, tân Thạc Sĩ đánh dấu cột mốc quan trọng trên con đường phát triển.",
                "Chính thức trở thành chuyên gia – phát triển các kỹ năng lãnh đạo cần thiết để thúc đẩy sự thay đổi tích cực trong lĩnh vực của bạn.",
            ],
            link_iframe:
                "https://www.youtube.com/embed/ZrLeuFGGXQI?si=0tiJvbnRDzwEyo3B",
            listImgs: [
                "https://ideas.edu.vn/wp-content/uploads/2025/11/ltnumef10202501.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/11/DSC_9177.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/11/DSCF6555.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/11/DSCF6740.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/11/DSCF6777.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/03/NHP_4768.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/03/NHP_4712.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/03/NHP_4367.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/03/NHP_4528.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/03/NHP_4783.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/03/NHP_4447.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/03/NHP_4356.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/03/NHP_4861.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/03/NHP_4840.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/03/NHP_4799.jpg",
            ],
            level: "MBA",
            avatar: "https://ideas.edu.vn/wp-content/uploads/2025/09/emba.png.webp",
            name: "Executive MBA",
            school: "Swiss UMEF",
            subjects: "<b>60</b> tín chỉ ECTS - <b>10</b> môn không luận văn",
            duration: "14-16 tháng",
            country: "Thuỵ Sĩ",
            experience: [
                "Tốt nghiệp cử nhân",
                "Tối thiểu 2 năm kinh nghiệm làm việc",
                "Tiếng Anh giao tiếp tốt hoặc bằng cấp tương đương IELTS 6.0",
            ],
            test: {
                high: [
                    "Lớp học tương tác trực tiếp, được trao đổi và thảo luận cùng Giảng viên và học viên",
                    "Kiến thức hướng đến thực hành giải quyết các vấn đề quản lý chuyên sâu",
                    "Lộ trình học tinh gọn 10 môn - không làm luận văn",
                    "Học phí linh hoạt chia nhỏ hoặc trả góp",
                ],
                stand: [
                    "Thời gian học tập, nghiên cứu tự sắp xếp linh hoạt, hỗ trợ bởi các giảng viên Việt Nam trong quá trình học",
                    "Kiến thức hướng đến thực hành giải quyết các vấn đề quản lý chuyên sâu",
                    "Lộ trình học tinh gọn 10 môn - không làm luận văn",
                    "Học phí linh hoạt chia nhỏ hoặc trả góp",
                ],
            },
            highlight: [
                "Trực tuyến 100%",
                "Thạc sĩ (Master)",
                "20:00 - 23:00 (Vietnam)",
                "2 buổi chuyên đề/môn (Chủ nhật)",
            ],
            tagline:
                "Đại học tư thục đầu tiên tại Geneva đạt kiểm định liên bang cao nhất Thuỵ Sĩ - Swiss Accreditation Council",
            link: "/swiss-umef-executive-mba",
            description:
                "Chương trình EMBA Online phù hợp cho người bận rộn. Bằng cấp được công nhận bởi Hội đồng Kiểm định Liên bang Thụy Sĩ, đảm bảo giá trị quốc tế, mang đến kiến thức thực tiễn và cập nhật theo xu hướng kinh doanh toàn cầu.",
            demographic: {
                jobs: [
                    {
                        jobname: "Quản trị kinh doanh",
                        percent: 30,
                    },
                    {
                        jobname: "Ngân hàng",
                        percent: 22,
                    },
                    {
                        jobname: "Công nghệ thông tin",
                        percent: 20,
                    },
                    {
                        jobname: "Start-up",
                        percent: 16,
                    },
                    {
                        jobname: "Khác",
                        percent: 12,
                    },
                ],
                ages: [
                    {
                        jobname: "18 - 24",
                        percent: 7,
                    },
                    {
                        jobname: "25 - 30",
                        percent: 27,
                    },
                    {
                        jobname: "31 - 40",
                        percent: 55,
                    },
                    {
                        jobname: "41 - 50",
                        percent: 10,
                    },
                    {
                        jobname: "51+",
                        percent: 1,
                    },
                ],
            },
            degree: {
                back: "https://ideas.edu.vn/wp-content/uploads/2025/11/Sample_page-0002.webp",
                front:
                    "https://ideas.edu.vn/wp-content/uploads/2025/11/Sample_page-0001.webp",
                transcript:
                    "https://ideas.edu.vn/wp-content/uploads/2025/11/Sample_page-0003.webp",
            },
            fee_plane: "3,000",
            fee_course: [
                // {
                //   name: "Standard",
                //   icon: "https://ideas.edu.vn/wp-content/new_public/data_imgs/icon6.png",
                //   price: "2.900 CHF",
                //   benefits: [
                //     "<b>Dành cho học viên đăng ký từ 01/08/2025:</b> Trợ phí từ trường giảm <b>500 CHF</b>.",
                //     "Tài khoản truy cập tài liệu học tập, môn học theo chương trình gốc của trường.",
                //     "Trợ lý chương trình nhắc deadline, hỗ trợ hệ thống, kết nối giảng viên qua Group Zalo/Email.",
                //     "I-AI: Chatbot hỗ trợ nội dung và giải đáp thắc mắc (Viện IDEAS).",
                //     "Lớp chuyên đề của Viện IDEAS tổ chức 2 ngày Chủ nhật vào tuần thứ 2 và thứ 4 mỗi môn, từ 8h30 - 11h30 và 13h30 - 16h30, nhằm giúp kiểm tra và hướng dẫn hoàn thành bài Final Exam.",
                //   ],
                // },
                {
                    name: "High Quality",
                    icon: "https://ideas.edu.vn/wp-content/new_public/data_imgs/icon5.png",
                    price: "9.220 CHF",
                    // price_promo: "4.165 CHF",
                    benefits: [
                        "Chính sách ưu đãi 1.100 CHF áp dụng đến hết ngày 22/03/2026",
                        "Hỗ trợ trả góp 12 - 24 tháng qua Sacombank",
                        "Bao gồm chương trình Standard và Hệ thống học tập eAcademy.",
                        "Ứng dụng công nghệ - Platform Ai cho học tập do IDEAS phát triển",
                        "Lớp học GVNN vào các buổi tối trong tuần (tùy chọn)",
                        "Lịch học: mỗi môn học kéo dài 04 tuần, mỗi tuần có 02 buổi tối học với giảng viên nước ngoài của trường (lịch dự kiến rơi vào tối thứ 3 và tối thứ 5, mỗi buổi từ 2-3 tiếng, từ 20h00 - 22h00)",
                        // "Bao gồm 2 chuyến đi Thụy sĩ ( 03 ngày lưu trú, phí học tập/LTN, di chuyển nội bộ  Thụy sĩ).",
                        "Đánh giá sơ bộ bài Final: Được hội đồng chuyên môn của Viện IDEAS đánh giá, góp ý bài Final đã đi đúng hướng, tránh lạc đề, học viên nắm được điểm đánh giá sơ bộ và hạn chế được khả năng rớt môn.",
                    ],
                },
            ],
            accreditation: [
                {
                    name: "Công nhận và Kiểm định",
                    logo: "https://ideas.edu.vn/wp-content/new_public/data_imgs/kdumef1.png",
                    link: "#",
                },
                {
                    name: "Công nhận và Kiểm định",
                    logo: "https://ideas.edu.vn/wp-content/new_public/data_imgs/kdumef3.png",
                    link: "#",
                },
                {
                    name: "Công nhận và Kiểm định",
                    logo: "https://ideas.edu.vn/wp-content/new_public/data_imgs/kdumef4.png",
                    link: "#",
                },
                {
                    name: "Công nhận và Kiểm định",
                    logo: "https://ideas.edu.vn/wp-content/new_public/data_imgs/kdumef5.png",
                    link: "#",
                },
                {
                    name: "Công nhận và Kiểm định",
                    logo: "https://ideas.edu.vn/wp-content/uploads/2023/12/vnanric.jpg",
                    link: "#",
                },
                {
                    name: "Công nhận và Kiểm định",
                    logo: "https://ideas.edu.vn/wp-content/new_public/data_imgs/kdumef2.png",
                    link: "#",
                },
            ],
            require: [
                "Bằng cử nhân và bảng điểm",
                "Sơ yếu lí lịch (CV)",
                "Thư động lực (Motivation Letter)",
                "Ảnh hộ chiếu (4×6)",
                "Passport",
                "Tiếng anh tương đương IELTS 6.0 hoặc có thể phỏng vấn đầu vào với đại diện của trường tại Việt Nam",
                "Admission Form <a href='https://ideas.edu.vn/wp-content/uploads/2025/03/ADMISSION-FORM_ENG_EMBA-_UMEF.docx' target='_blank' class='text_download'>(Download Here)</a>",
            ],
            faq: [
                {
                    q: "Chương trình EMBA có yêu cầu bảo vệ luận văn không?",
                    a: "Không. Chương trình EMBA của Swiss UMEF bao gồm 10 môn học và không yêu cầu bảo vệ luận văn. Học viên hoàn thành tất cả các môn học theo quy định sẽ đủ điều kiện nhận bằng EMBA do Swiss UMEF cấp. Điều này giúp học viên tối ưu thời gian học tập và tập trung vào việc nâng cao kỹ năng quản lý thực tiễn.",
                },
                {
                    q: "Lễ tốt nghiệp sau khi hoàn thành EMBA sẽ được tổ chức ở đâu, có thể qua Trường không?",
                    a: "Sau khi hoàn thành chương trình EMBA, học viên sẽ được tham gia lễ tốt nghiệp do Swiss UMEF tổ chức. Thông thường, lễ tốt nghiệp sẽ diễn ra tại Geneva, Thụy Sĩ, nơi đặt trụ sở chính của Trường. Tuy nhiên, Swiss UMEF cũng có thể tổ chức buổi lễ tốt nghiệp tại Việt Nam hoặc các địa điểm khác tùy theo số lượng học viên và điều kiện tổ chức. Học viên có thể lựa chọn tham dự lễ tốt nghiệp tại Geneva hoặc tại địa điểm do Viện IDEAS phối hợp tổ chức.",
                },
                {
                    q: "Sau khi hoàn thành chương trình EMBA, có thể học lên Tiến sĩ không?",
                    a: "Có, sau khi hoàn thành chương trình EMBA của Swiss UMEF, học viên có thể tiếp tục học lên chương trình Tiến sĩ Quản trị Kinh doanh (DBA – Doctor of Business Administration) tại các trường đại học hoặc tổ chức giáo dục phù hợp. <br/> Tuy nhiên, việc được chấp nhận vào chương trình Tiến sĩ sẽ tùy thuộc vào đơn vị tiếp nhận. Một số trường có thể yêu cầu học viên hoàn thành thêm một số môn bổ sung để đáp ứng điều kiện đầu vào của chương trình DBA hoặc PhD. Học viên có thể liên hệ với Viện IDEAS để được tư vấn cụ thể về lộ trình học tiếp và các yêu cầu xét tuyển.",
                },
            ],
            this_subjects: [
                {
                    name: "EMBA 400. Marketing Management",
                    description:
                        "This course progressively builds on marketing issues by exploring more advanced topics and strategic planning in the marketing concept. Our attention will be drawn to laying the groundwork by strategically planning all the marketing approaches and analyzing the external and internal environment of the organization. <br/><br/> This course also examines the dynamic environment inhabited by today's marketers, helping students understand the marketplace and integrate the appropriate information into marketing decisions. The course focuses on an integrated approach and strategy-based actions, covering only those critical and advanced issues required to succeed in future professional work. <br/><br/> Additionally, our focus includes the concept of marketing, the marketing manager's job, the development of a marketing strategy, marketing research, consumer behavior and analysis, organizational buying behavior; market structure and competitor analysis; marketing mix decision-making; communications and advertising strategy; channels of distribution; the personal sales channel; pricing; sales promotion; strategies for service markets; strategies for technology-based markets; global marketing strategies; and new product development",
                    link: "",
                    credit: 6,
                },
                {
                    name: " EMBA 401. Human Capital and Talent Management",
                    description:
                        "This course is designed to provide a fresh approach to management students, based on dynamic, real-life organizational events confronting both human resource managers and line managers who often implement personnel programs and policies. <br/><br/> Human Resource Management takes a managerial orientation and is viewed as being relevant to managers in every unit, project or team. Managers are constantly faced with human relation management issues, problems and decision making. <br/><br/>  This course will introduce management students to HR activities (recruitment and selection, training and development, reward management and performance appraisal) with the emphasis that it is the bundles of HR interventions and not single practices that develop effective human resources. Based on realistic, current trends confronting managers, this course will also expose the management students to contemporary issues, such as, employee engagement and organizational change, and how HR can work together with knowledge management, technology, internationalization - and talent management - to further develop the effectiveness of human resources and help create, develop and sustain a high-performing organization",
                    link: "https://youtu.be/CebD5PCML6w?si=qbXiR8r9eztjvUvM",
                    credit: 6,
                },
                {
                    name: "EMBA 402. Entrepreneurship and Innovation",
                    description:
                        "This course explores the principles and practices of entrepreneurship and innovation. Students will learn how to identify and evaluate entrepreneurial opportunities, develop innovative ideas, and create viable business models. The course emphasizes critical thinking, creativity, and problem-solving skills necessary for successful entrepreneurship. Students will also gain an understanding of the challenges and strategies involved in launching and growing a new venture in a dynamic business environment",
                    link: "https://youtu.be/t1g7aCRoC-I?si=5luqjqunPivUr5wL",
                    credit: 6,
                },
                {
                    name: "EMBA 403. Corporate Finance",
                    description:
                        "This course systematically unfolds crucial issues in corporate finance management at graduate level. We review the introductory aspect of the course, and build from there toward approaches of investment appraisals, explaining details as regards the methods like compound interest, net present value decision rule and the internal rate of return. Additionally, methods such as the annuities and perpetuities, sinking fund and discounted cash flows and tax payments would be fully discussed. <br/><br/> Issues in capital rationing and risk analysis are discussed under certain market conditions, considering the constraint, sensitivity analysis. <br/><br/> Our study efforts will also consider portfolio theory and capital asset pricing model, which is an important aspect of corporate financial management, together with the capital budgeting model and the associated specific tools used in portfolio theory and pricing decision. <br/><br/> Other topics such as market share value and pricing would be examined to give students advanced knowledge of the company‘s worth. We further go on to dividend decision, which is the crux of cash management concern, as against retained earning for futures operations and the rule of safety thumps",
                    link: "https://youtu.be/zk1-2CERWHs?si=tT-pLAUoA5iI_b3h",
                    credit: 6,
                },
                {
                    name: "EMBA 404. Accounting for Managers",
                    description:
                        "This course is designed to provide students with an understanding of the interplay between politics, economics, and geography in shaping international relations. Students will learn about the key concepts and theories of geopolitics and geoeconomics, as well as their practical applications in contemporary world affairs",
                    link: "",
                    credit: 6,
                },
                {
                    name: "EMBA 405. Digital Transformation",
                    description:
                        "The course will deepen the student’s comprehension of the digital transformation that is pervading society. The course will examine the process that contributes to the transitions to a digital society and economy. Therefore, digitalization is having an impact on different levels, affecting structures and the strategies of the organization, their ability to respond to external stimuli, the interactions with the stakeholders and the definition of the value proposition. Hence, the Digital transformation course aims also to support the students to understand the problems that the digital transformation might arise and, at the same time, to assess the new opportunities that the digitalization produces",
                    link: "",
                    credit: 6,
                },
                {
                    name: "EMBA 406. Strategy Management",
                    description:
                        "This course introduces the key concepts, tools, and principles of strategy formulation and competitive analysis. It is concerned with managerial decisions and actions that affect the performance and survival of business enterprises. The course is focused on the information, analyses, organizational processes, and skills and business judgment managers must use to devise strategies, position their businesses, define firm boundaries and maximize long-term profits in the face of uncertainty and competition.  The course takes a general management perspective, viewing the firm as a whole, and examining how policies in each functional area are integrated into an overall competitive strategy. The key strategic business decisions of concern in this course involve choosing competitive strategies, creating competitive advantages, taking advantage of external opportunities, securing and defending sustainable market positions, and allocating critical resources over long periods. Decisions such as these can only be made effectively by viewing a firm holistically, and over the long term",
                    link: "https://youtu.be/wVY3uLMG-Fk?si=rTdwcjAk6-tEgbqS",
                    credit: 6,
                },
                {
                    name: "EMBA 407. Project Management",
                    description:
                        "Project management is a key contributor to organizational success and business results. This course teaches the fundamentals of project management. Students will learn how to select projects (portfolio management), lead and manage projects, build project teams, handle project risks, manage costs and schedules, control project progress, terminate projects, and integrate sustainability considerations throughout the project life cycle",
                    link: "https://youtu.be/MMYVUtpiAPk?si=R1XbXLyILON4-yK6",
                    credit: 6,
                },
                {
                    name: "EMBA 408. Organizational Behaviour",
                    description:
                        "This course provides a comprehensive understanding of supply chain management, covering the key concepts, strategies, and practices involved in managing the flow of goods and services from suppliers to end customers. Students will explore various aspects of supply chain management, including procurement, logistics, inventory management, demand forecasting, and supplier relationships. The course aims to develop students' skills in designing, optimizing, and coordinating supply chain activities to achieve competitive advantage and operational excellence",
                    link: "",
                    credit: 6,
                },
                {
                    name: "EMBA 409. Leadership Development",
                    description:
                        "This course approaches the Cross-Cultural Leadership from an organisational perspective, where individuals from different cultures, religions, and educational backgrounds interact on a daily basis. The organisation, where decisions are made collectively, promote people interactions and responsibilities incorporating the sense of importance of multiculturalism into its strategic vision. <br/><br/>  This course aims to develop an easily applied and solid rule to identify cross-cultural differences within the organisation that can create robust boundaries and link them to the effective attainment of group goals. At the same time, the course observes real-life cases where meaningful differences exist but address appropriately through leadership of cultural diversity",
                    link: "",
                    credit: 6,
                },
            ],
        },
        IDEAS04: {
            benefits: [
                "Chương trình cung cấp kiến thức AI nền tảng và ứng dụng thực tiễn, giúp lãnh đạo doanh nghiệp triển khai AI để tối ưu vận hành, ra quyết định và phát triển bền vững.",
                "Hiểu biết sâu sắc về các công nghệ AI hiện đại. Ứng dụng AI vào quản lý, phân tích dữ liệu và ra quyết định.",
                "Phát triển kỹ năng lãnh đạo trong môi trường công nghệ cao.",
                "Viện IDEAS hỗ trợ: hệ thống IDEAS – LMS & lớp chuyên đề bổ trợ vào các ngày Chủ nhật, có hướng dẫn bài tập và đánh giá sơ bộ bài Final exam.",
                "Lễ tốt nghiệp và chuyến đi học tập tại trụ sở chính của trường – Geneva Thụy Sĩ.",
            ],
            program_name_degree:
                "Master of Science in Applied Artificial Intelligence",
            program_benefits_degree: [
                "Tấm bằng Chuyên gia quản trị AI – MSc AI danh giá được trao từ một trường kinh doanh lâu đời tại Thuỵ Sĩ.",
                "Là cựu học viên của trường Swiss UMEF đánh dấu cột mốc quan trọng trên con đường phát triển.",
                "Chính thức trở thành chuyên gia quản trị bằng AI – phát triển các kỹ năng lãnh đạo, sử dụng các công cụ AI cần thiết để thúc đẩy sự thay đổi tích cực trong lĩnh vực của bạn.",
            ],
            link_iframe:
                "https://www.youtube.com/embed/mB0mDrgjVNs?si=wP6X9bDGqVVR2R28",
            listImgs: [
                "https://ideas.edu.vn/wp-content/uploads/2025/11/ltnumef10202501.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/11/DSC_9177.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/11/DSCF6555.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/11/DSCF6740.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/11/DSCF6777.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/03/NHP_4193.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/03/NHP_4314.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/03/NHP_4298.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/03/NHP_4268.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/03/NHP_4255.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/03/NHP_4240.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/03/NHP_4215.jpg",
            ],

            level: "MBA",
            avatar: "https://ideas.edu.vn/wp-content/uploads/2025/09/mscai.png.webp",
            name: "MSc AI",
            school: "Swiss UMEF",
            subjects: "<b>90</b> tín chỉ ECTS - <b>12</b> môn và luận văn",
            duration: "18 tháng",
            country: "Thuỵ Sĩ",
            test: {
                high: [
                    "Vận dụng AI trong quản lý doanh nghiệp",
                    "Hiểu biết chuyên sâu hơn về cách thức quản trị của các doanh nghiệp bằng AI trong thời đại mới",
                    "Lớp học tương tác trực tiếp, được trao đổi và thảo luận cùng Giảng viên và học viên",
                    "Học phí linh hoạt chia nhỏ hoặc trả góp",
                ],
            },
            experience: [
                "Tốt nghiệp cử nhân",
                "Tối thiểu 2 năm kinh nghiệm ở cấp độ quản lý",
                "Tiếng Anh giao tiếp tốt hoặc bằng cấp tương đương IELTS 6.0",
            ],
            highlight: [
                "Trực tuyến 100%",
                "Thạc sĩ (Master)",
                "20:00 T3 - T5 (2-3h/buổi)",
                "2 buổi chuyên đề/môn (Chủ nhật)",
            ],
            tagline:
                "Đại học tư thục đầu tiên tại Geneva đạt kiểm định liên bang cao nhất Thuỵ Sĩ - Swiss Accreditation Council",
            link: "/swiss-umef-msc-ai",
            description:
                "Chương trình AI được thiết kế đặc biệt cho những nhà quản trị kinh doanh, những người muốn khám phá và khai thác tiềm năng của trí tuệ nhân tạo trong quản lý doanh nghiệp",
            demographic: {
                jobs: [
                    {
                        jobname: "Công nghệ thông tin",
                        percent: 40,
                    },
                    {
                        jobname: "Quản trị kinh doanh",
                        percent: 30,
                    },
                    {
                        jobname: "Ngân hàng",
                        percent: 12,
                    },

                    {
                        jobname: "Start-up",
                        percent: 10,
                    },
                    {
                        jobname: "Khác",
                        percent: 8,
                    },
                ],
                ages: [
                    {
                        jobname: "18 - 24",
                        percent: 7,
                    },
                    {
                        jobname: "25 - 30",
                        percent: 27,
                    },
                    {
                        jobname: "31 - 40",
                        percent: 55,
                    },
                    {
                        jobname: "41 - 50",
                        percent: 10,
                    },
                    {
                        jobname: "51+",
                        percent: 1,
                    },
                ],
            },

            degree: {
                back: "https://ideas.edu.vn/wp-content/uploads/2025/11/Sample_page-0002.webp",
                front:
                    "https://ideas.edu.vn/wp-content/uploads/2025/03/UMEF-MSc-Degree.jpg",
                transcript:
                    "https://ideas.edu.vn/wp-content/uploads/2025/11/Sample_page-0003.webp",
            },
            fee_plane: "4,400",
            fee_course: [
                {
                    name: "High Quality",
                    icon: "https://ideas.edu.vn/wp-content/new_public/data_imgs/icon5.png",
                    price: "11.900 CHF",
                    price_promo: "4.165 CHF",
                    benefits: [
                        "Hỗ trợ trả góp 12 - 24 tháng qua Sacombank",
                        "Lớp học GVNN vào các buổi tối trong tuần (tùy chọn)",
                        "Ứng dụng công nghệ - Platform Ai cho học tập do IDEAS phát triển",
                        "Tài khoản truy cập tài liệu học tập, môn học theo chương trình gốc của trường",
                        "Trợ lý chương trình nhắc deadline, hỗ trợ hệ thống, kết nối giảng viên qua Group Zalo/Email.",
                        "Lịch học: mỗi môn học kéo dài 04 tuần, mỗi tuần có 02 buổi tối học với giảng viên nước ngoài của trường (lịch dự kiến rơi vào tối thứ 3 và tối thứ 5, mỗi buổi từ 2-3 tiếng, từ 20h00 - 22h00)",
                        // "Học phí bao gồm 2 chuyến đi tốt nghiệp tại Thuỵ Sĩ trị giá <b.>4,400 CHF</b.",
                        "Đánh giá sơ bộ bài Final: Được hội đồng chuyên môn của Viện IDEAS đánh giá, góp ý bài Final đã đi đúng hướng, tránh lạc đề, học viên nắm được điểm đánh giá sơ bộ và hạn chế được khả năng rớt môn.",
                    ],
                },
            ],
            accreditation: [
                {
                    name: "Công nhận và Kiểm định",
                    logo: "https://ideas.edu.vn/wp-content/new_public/data_imgs/kdumef1.png",
                    link: "#",
                },
                {
                    name: "Công nhận và Kiểm định",
                    logo: "https://ideas.edu.vn/wp-content/new_public/data_imgs/kdumef3.png",
                    link: "#",
                },
                {
                    name: "Công nhận và Kiểm định",
                    logo: "https://ideas.edu.vn/wp-content/new_public/data_imgs/kdumef4.png",
                    link: "#",
                },
                {
                    name: "Công nhận và Kiểm định",
                    logo: "https://ideas.edu.vn/wp-content/new_public/data_imgs/kdumef5.png",
                    link: "#",
                },
                {
                    name: "Công nhận và Kiểm định",
                    logo: "https://ideas.edu.vn/wp-content/uploads/2023/12/vnanric.jpg",
                    link: "#",
                },
                {
                    name: "Công nhận và Kiểm định",
                    logo: "https://ideas.edu.vn/wp-content/new_public/data_imgs/kdumef2.png",
                    link: "#",
                },
            ],
            require: [
                "Bằng cử nhân và bảng điểm",
                "Sơ yếu lí lịch (CV)",
                "Thư động lực (Motivation Letter)",
                "Ảnh hộ chiếu (4×6)",
                "Passport",
                "Tiếng anh tương đương IELTS 6.0 hoặc có thể phỏng vấn đầu vào với đại diện của trường tại Việt Nam",
                "Admission Form <a href='https://ideas.edu.vn/wp-content/uploads/2025/03/ADMISSION-FORM_ENG_MSC_UMEF.docx' target='_blank' class='text_download'>(Download Here)</a>",
            ],
            faq: [
                {
                    q: "Không có bằng cử nhân về công nghệ hoặc khoa học máy tính, tôi có thể đăng ký học MSc AI không?",
                    a: "Có! Bạn hoàn toàn có thể đăng ký học MSc AI ngay cả khi không có bằng cử nhân về công nghệ hoặc khoa học máy tính. Chương trình MSc AI của Swiss UMEF được thiết kế theo hướng ứng dụng, không chỉ dành cho những ai có nền tảng công nghệ mà còn phù hợp với các chuyên gia, nhà quản lý, hoặc những người muốn ứng dụng AI vào lĩnh vực kinh doanh, tài chính, marketing, quản lý… Nếu bạn chưa có nền tảng về lập trình hoặc dữ liệu, chương trình sẽ có những học phần giúp bạn làm quen với các công cụ AI mà không cần kiến thức quá chuyên sâu về kỹ thuật. Bạn sẽ được hướng dẫn từng bước để áp dụng AI vào công việc thực tế.",
                },
                {
                    q: "Chương trình MSc AI có yêu cầu học viên phải có nền tảng hoặc sử dụng những ứng dụng đặc biệt nào không?",
                    a: "Chương trình MSc AI của Swiss UMEF được thiết kế theo hướng ứng dụng, phù hợp với học viên từ nhiều lĩnh vực khác nhau, kể cả những người chưa có nền tảng công nghệ. Để đảm bảo học viên có sự chuẩn bị tốt nhất, Viện IDEAS hỗ trợ hai môn nền tảng: Machine Learning & Deep Learning – giúp học viên làm quen với các khái niệm cốt lõi trong AI. Quản trị AI – giúp học viên hiểu cách ứng dụng AI vào thực tế doanh nghiệp và quản lý công nghệ hiệu quả. Nhờ đó, dù bạn xuất phát từ lĩnh vực nào, bạn vẫn có thể theo học và áp dụng AI vào công việc của mình một cách vững vàng.",
                },
                {
                    q: "Có thể vừa học vừa đi làm không? Cường độ học có quá nặng không?",
                    a: "Hoàn toàn có thể! Chương trình MSc AI của Swiss UMEF được thiết kế linh hoạt, phù hợp với người đang đi làm. Học trực tuyến, giúp bạn chủ động sắp xếp thời gian, nhưng cần đảm bảo tham gia lớp học vì chương trình yêu cầu không được vắng quá 30% số giờ học. Thời gian vào buổi tối rất thuận tiện sắp xếp theo khung giờ của Việt Nam. Viện IDEAS hỗ trợ học viên thêm thông qua các lớp chuyên đề, chia sẻ bài tập và tổ chức workshop/seminar giúp học viên hiểu sâu hơn về ứng dụng thực tế của AI.",
                },
            ],
            this_subjects: [
                {
                    name: "Artificial Intelligence and Machine Learning",
                    description:
                        "Môn học giới thiệu các khái niệm cơ bản về trí tuệ nhân tạo (AI) và học máy (ML), bao gồm học có giám sát, không giám sát, mạng nơ-ron nhân tạo và các mô hình học sâu (Deep Learning). Sinh viên sẽ áp dụng các kỹ thuật này vào dữ liệu thực tế trong nhiều ngành nghề khác nhau.",
                    link: "",
                    credit: 6,
                },
                {
                    name: "Digital and Computer Vision",
                    description:
                        "Môn học trang bị kiến thức về xử lý ảnh số và thị giác máy tính, bao gồm các kỹ thuật như trích xuất đặc trưng, nhận dạng đối tượng, phát hiện chuyển động, và các ứng dụng thực tiễn trong robot, xe tự hành và AI.",
                    link: "",
                    credit: 6,
                },
                {
                    name: "Big Data Analytics",
                    description:
                        "Môn học tập trung vào việc thu thập, lưu trữ, xử lý và phân tích dữ liệu lớn. Sinh viên sẽ làm quen với các công cụ như Hadoop, Spark, và áp dụng phân tích dữ liệu để hỗ trợ ra quyết định trong kinh doanh và công nghệ.",
                    link: "",
                    credit: 6,
                },
                {
                    name: "IoT",
                    description:
                        "Môn học cung cấp kiến thức về thiết kế, điều khiển và vận hành hệ thống IoT trong công nghiệp, y tế và đời sống.",
                    link: "",
                    credit: 6,
                },
                {
                    name: "Reinforcement Learning and AI Optimization",
                    description:
                        "Môn học đi sâu vào học tăng cường (Reinforcement Learning) và các kỹ thuật tối ưu hóa trong AI. Bao gồm các khái niệm như MDP, Q-learning, Deep Q-Network và ứng dụng trong robot, game, tài chính.",
                    link: "",
                    credit: 6,
                },
                {
                    name: "AI in Business Decision Making",
                    description:
                        "Môn học giới thiệu cách ứng dụng AI vào các quyết định kinh doanh như tài chính, marketing, vận hành và nhân sự. Sinh viên sẽ học cách dùng phân tích dự đoán, tự động hóa và AI để tối ưu hóa hiệu suất tổ chức.",
                    link: "",
                    credit: 6,
                },
                {
                    name: "Economic Forecasting and AI-Driven Market Dynamics",
                    description:
                        "Môn học tập trung vào việc dự báo kinh tế và phân tích thị trường bằng AI. Sinh viên sẽ học cách dùng các mô hình học máy để phân tích dữ liệu kinh tế, hành vi thị trường và hỗ trợ ra quyết định tài chính.",
                    link: "",
                    credit: 6,
                },
                {
                    name: "Financial Intelligence and Algorithmic Trading",
                    description:
                        "Môn học tập trung vào ứng dụng AI trong tài chính và giao dịch thuật toán. Sinh viên sẽ học cách xây dựng mô hình giao dịch tự động, tối ưu hóa danh mục đầu tư và phân tích rủi ro tài chính bằng AI.",
                    link: "",
                    credit: 6,
                },
                {
                    name: "AI Innovation and Entrepreneurship",
                    description:
                        "Môn học giúp sinh viên phát triển các ý tưởng kinh doanh và đổi mới sáng tạo dựa trên AI. Nội dung bao gồm phát hiện cơ hội thị trường, phát triển sản phẩm và xây dựng chiến lược khởi nghiệp với công nghệ AI.",
                    link: "",
                    credit: 6,
                },
                {
                    name: "Advanced Project Management in AI",
                    description:
                        "Môn học cung cấp các kỹ năng quản lý dự án chuyên sâu trong lĩnh vực AI. Sinh viên sẽ học về quản lý thời gian, nguồn lực, rủi ro và phương pháp Agile/Scrum áp dụng trong dự án công nghệ AI.",
                    link: "",
                    credit: 6,
                },
                {
                    name: "Change management strategies for AI transition",
                    description:
                        "Môn học trang bị chiến lược và kỹ năng quản lý thay đổi trong tổ chức khi triển khai công nghệ AI. Bao gồm kỹ năng lãnh đạo, giao tiếp, và xử lý kháng cự để đảm bảo quá trình chuyển đổi thành công.",
                    link: "",
                    credit: 6,
                },
                {
                    name: "Global AI policies and regulatory frameworks",
                    description:
                        "Môn học nghiên cứu các chính sách và quy định về AI trên toàn cầu. Sinh viên sẽ phân tích tác động của luật pháp đến đổi mới công nghệ và những thách thức trong việc xây dựng khung pháp lý phù hợp cho AI.",
                    link: "",
                    credit: 6,
                },
                {
                    name: "Capstone Project",
                    description:
                        "Đồ án tốt nghiệp toàn diện, nơi sinh viên vận dụng các kiến thức và kỹ năng đã học để thực hiện một dự án AI thực tế hoặc viết báo cáo thực tập chuyên sâu.",
                    link: "",
                    credit: 18,
                },
            ],
        },
        IDEAS05: {
            benefits: [
                "DBA không chỉ là một chương trình học thuật mà còn là một cơ hội để các chuyên gia trong lĩnh vực quản trị kinh doanh nghiên cứu và thảo luận về những vấn đề thực tế mà họ đang gặp phải trong lĩnh vực, ngành nghề đang kinh doanh. Từ đó đưa ra một mô hình hoặc một giải pháp có thể áp dụng trong phạm vi một lĩnh vực, một ngành nghề cụ thể.",
                "Mục tiêu của chương trình DBA là phát triển những nhà lãnh đạo trong lĩnh vực kinh doanh có khả năng áp dụng kiến thức nghiên cứu vào thực tiễn, đồng thời góp phần vào sự phát triển của tri thức trong ngành.",
                "Viện IDEAS hỗ trợ: hệ thống IDEAS – LMS & lớp chuyên đề bổ trợ vào các ngày Chủ nhật, có hướng dẫn bài tập và đánh giá sơ bộ bài Final exam.",
                "Chuyến đi dự lễ tốt nghiệp và nhận bằng tại trụ ở chính của trường – Paris Pháp, kết hợp cùng với chuyến tham quan các thành phố thủ đô lớn ở Châu Âu: Thụy Sĩ – Pháp – Bỉ – Hà Lan (các nước trong cùng 1 chuyến đi).",
            ],
            program_name_degree: "Executive DBA",
            program_benefits_degree: [
                "Tấm bằng DBA, cấp độ cao nhất của học vị, từ một trường kinh doanh lớn, danh tiếng và campus trãi dài rộng khắp thế giới.",
                "Tân Tiến Sĩ của trường Ascencia Business School đánh dấu cột mốc cực kỳ quan trọng trên con đường phát triển.",
                "Là một chuyên gia thực thụ có đầy đủ các kỹ năng lãnh đạo cần thiết để thúc đẩy sự thay đổi lớn trong lĩnh vực của bạn.",
            ],
            link_iframe:
                "https://www.youtube.com/embed/L2NjRsGCxmA?si=F5314uWJU-8-sZcp",
            listImgs: [
                "https://ideas.edu.vn/wp-content/uploads/2024/08/dba-1.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2024/08/DSC_1036.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2024/08/DSC_1039.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2024/08/DSC_1042.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2024/08/DSC_1054.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2024/08/DSC_1057.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2024/08/DSC_1061.jpg",
            ],
            level: "DBA",
            avatar: "https://ideas.edu.vn/wp-content/uploads/2025/09/dba-01.png.webp",
            name: "Executive DBA",
            highlight: [
                "Trực tuyến 100%",
                "DBA",
                "Nghiên cứu với cố vấn",
                "2 buổi chuyên đề/môn (Chủ nhật)",
            ],
            school: "Ascencia Business School",
            country: "Pháp",

            subjects: "<b>4</b> giai đoạn | <b>2.5 - 4</b> năm - 1 luận văn",
            duration: "2.5 - 4 năm",
            tagline: "Là trường thành viên của tổ chức giáo dục College de Paris",
            link: "/ascencia-online-dba",
            experience: [
                "Tốt nghiệp Thạc sĩ hoặc Global MBA",
                "Tiếng Anh giao tiếp tốt hoặc bằng cấp tương đương IELTS 6.0",
            ],
            // test: [
            //   "Chương trình học tập, làm bài và nộp trên flatform của trường, dựa trên tài liệu và hướng dẫn của Giáo sư",
            //   "Kiến thức quản trị chuyên sâu, kết hợp với case study thực tiễn",
            //   "Thời gian học tập tự sắp xếp linh hoạt",
            // ],
            fee_plane: "4,400",
            fee_course: [
                {
                    name: "High Quality",
                    icon: "https://ideas.edu.vn/wp-content/new_public/data_imgs/icon5.png",
                    price: "11.900 Euro",
                    benefits: [
                        "Hệ thống sinh viên Quốc tế của College de Paris: <a target='_blank' href='https://online.cdp-global.org' class='text_link'>Online CDP Global</a>.",
                        "Thư viện tài liệu nghiên cứu: <a target='_blank' href='https://login.ebsco.com/' class='text_link'>EBSCO</a>.",
                        "Hệ thống LMS hỗ trợ: ứng dụng I-AI để hỗ trợ trong quá trình học tập.",
                        "Thời gian nghiên cứu: 2.5 – 4 năm.",
                        "Trợ lý chương trình nhắc deadline, hỗ trợ hệ thống, kết nối giảng viên qua Group Zalo/Email.",
                        "Tự nghiên cứu với sự định hướng và hướng dẫn của Giáo sư.",

                        "Đánh giá sơ bộ bài Final: Được hội đồng chuyên môn của Viện IDEAS đánh giá, góp ý bài Final đã đi đúng hướng, tránh lạc đề, học viên nắm được điểm đánh giá sơ bộ và hạn chế được khả năng rớt môn.",
                    ],
                },
            ],

            description:
                "Chương trình Executive DBA là một chương trình nghiên cứu dành cho các chuyên gia cao cấp trong lĩnh vực quản trị kinh doanh. Khác với MBA (Master of Business Administration) – một chương trình chú trọng vào kiến thức tổng quát, DBA nhấn mạnh vào việc phát triển kiến thức và nghiên cứu chuyên sâu trong lĩnh vực quản lý",
            demographic: {
                jobs: [
                    {
                        jobname: "Quản trị kinh doanh",
                        percent: 30,
                    },
                    {
                        jobname: "Ngân hàng",
                        percent: 22,
                    },
                    {
                        jobname: "Công nghệ thông tin",
                        percent: 20,
                    },
                    {
                        jobname: "Start-up",
                        percent: 16,
                    },
                    {
                        jobname: "Khác",
                        percent: 12,
                    },
                ],
                ages: [
                    {
                        jobname: "18 - 24",
                        percent: 7,
                    },
                    {
                        jobname: "25 - 30",
                        percent: 27,
                    },
                    {
                        jobname: "31 - 40",
                        percent: 55,
                    },
                    {
                        jobname: "41 - 50",
                        percent: 10,
                    },
                    {
                        jobname: "51+",
                        percent: 1,
                    },
                ],
            },
            degree: {
                front:
                    "https://ideas.edu.vn/wp-content/uploads/2025/03/UMEF-EMBA-Degree-1.jpg",
                back: "https://ideas.edu.vn/wp-content/uploads/2024/11/MBA-Ascencia-Diploma-EN-MOFA-2.webp",
            },
            accreditation: [
                {
                    name: "Công nhận và Kiểm định",
                    logo: "http://www.collegedeparis.fr/wp-content/uploads/2021/06/fcomp-logo-site.png",
                    link: "#",
                },
                {
                    name: "Công nhận và Kiểm định",
                    logo: "http://www.collegedeparis.fr/wp-content/uploads/2021/06/fle-logo-site.png",
                    link: "#",
                },
                {
                    name: "Công nhận và Kiểm định",
                    logo: "http://www.collegedeparis.fr/wp-content/uploads/2021/07/qualiopirogne.png",
                    link: "#",
                },
                {
                    name: "Công nhận và Kiểm định",
                    logo: "http://www.collegedeparis.fr/wp-content/uploads/2021/06/erasmus-logo-site.png",
                    link: "#",
                },
                {
                    name: "Công nhận và Kiểm định",
                    logo: "http://www.collegedeparis.fr/wp-content/uploads/2021/06/fcomp-logo-site.png",
                    link: "#",
                },
                {
                    name: "Công nhận và Kiểm định",
                    logo: "http://www.collegedeparis.fr/wp-content/uploads/2021/06/bpi-logosite.png",
                    link: "#",
                },
                {
                    name: "Công nhận và Kiểm định",
                    logo: "https://ideas.edu.vn/wp-content/uploads/2023/12/vnanric.jpg",
                    link: "#",
                },
            ],
            require: [
                "Bằng và bảng điểm Thạc sĩ các chuyên ngành",
                "Sơ yếu lí lịch (CV)",
                "Thư động lực (Motivation Letter)",
                "Ảnh hộ chiếu (4×6)",
                "2 Thư giới thiệu",
                "Chứng chỉ tiếng Anh",
                "Passport",
                "Tiếng anh tương đương IELTS 6.0 hoặc có thể phỏng vấn đầu vào với đại diện của trường tại Việt Nam",
                "Application Form <a href='https://ideas.edu.vn/wp-content/uploads/2025/03/Application-Form-_-1.pdf' target='_blank' class='text_download'>(Download Here)</a>",
            ],
            faq: [
                {
                    q: "Chưa có kinh nghiệm nghiên cứu có thể theo học chương trình Executive DBA không?",
                    a: "Có. Chương trình Executive DBA được thiết kế dành cho các nhà quản lý, lãnh đạo muốn nâng cao tư duy chiến lược và năng lực nghiên cứu ứng dụng trong kinh doanh. Viện IDEAS cung cấp hướng dẫn chi tiết về phương pháp nghiên cứu, giúp học viên từng bước xây dựng luận án DBA mà không cần nền tảng nghiên cứu trước đó.",
                },
                {
                    q: "Nếu bận đi công tác không thể hoàn thành bài đúng hạn thì sao?",
                    a: "Chương trình Executive DBA được thiết kế linh hoạt để phù hợp với lịch trình bận rộn của học viên. Mỗi môn học đều có thời gian nghiên cứu cùng với giáo viên cố vấn. Deadline các bài tập thường vào lúc buổi tối Việt Nam. Học viên nắm được thông tin bài tập và deadline sẽ sắp xếp phù hợp. Trường hợp Học viên chưa thể hoàn thành đúng thời hạn sẽ được đăng ký <b>Resubmit</b> có tốn phí để được mở thêm 1 tuần nộp lại bài. ",
                },
                {
                    q: "Học viên có thể tham gia lễ tốt nghiệp tại Paris - Pháp không?",
                    a: "Có. Học viên hoàn thành chương trình có thể đăng ký tham gia lễ tốt nghiệp tại Pháp, cùng với các học viên quốc tế khác của Ascencia Business School. Mỗi năm có 2 đợt Lễ Tốt nghiệp vào tháng 6 và tháng 12. Viện IDEAS sẽ thông báo đến học viên về lịch thông báo từ Trường để học viên đăng kí.",
                },
            ],
            this_subjects: [
                {
                    name: "Giai đoạn 1: Các modules cốt lõi",
                    description:
                        "<b>Khoảng 9 tháng</b> <br/> Giai đoạn nền tảng, rất quan trọng cho sự bắt đầu một lộ trình nghiên cứu. Giai đoạn này giúp Nghiên cưu sinh ôn lại những kiến thức nền tảng của môn học Research Methodology đối với chuyên ngành Business research. Kết thúc giai đoạn này, NCS được trang bị kiến thức và kỹ năng nghiên cứu, hiểu sâu và vững chắc các phương pháp nghiên cứu khoa học. <br/><i class='fa-solid fa-caret-right'></i> Học viên được cấp tài khoản trên hệ thống của Trường, có textbook để tham khảo nội dung <br/><i class='fa-solid fa-caret-right'></i> Có 6 buổi học tập trung, mỗi buổi 2 - 3 giờ. Ngôn ngữ: song ngữ, Giảng viên của Viện IDEAS <br/><i class='fa-solid fa-caret-right'></i> Ngoài 6 buổi chính thức và tập trung, nếu NCS nào có nhu cầu có thể đăng ký thêm những buổi phụ đạo 1-1. <br/><i class='fa-solid fa-caret-right'></i> Cuổi giai đoạn: nộp research proposal",
                    link: "",
                },
                {
                    name: "Giai đoạn 2: Lựa chọn Giáo sư hướng dẫn",
                    description:
                        "<b>Khoảng 3 tháng</b> <br/>  Lựa chọn giảng viên theo danh sách mà Viện IDEAS cung cấp, bao gồm giảng viên của Viện IDEAS và giảng viên là người nước ngoài của Trường Ascencia (Đối với cố vấn của Viện IDEAS đã được hỗ trợ 100% chi phí Đối với cố vấn của Trường ASC sẽ có phí riêng tùy vào mỗi Giảng viên ) <br/><i class='fa-solid fa-caret-right'></i> Học viên và giảng viên trao đổi lại với nhau về proposal, để hai bên cùng cân nhắc thay đổi, điều chỉnh, mở rộng hoặc thu hẹp phạm vi nghiên cứu. <br/><i class='fa-solid fa-caret-right'></i> Nếu xác định đề tài chưa phù hợp, ở giai đoạn này học viên được đăng kí điều chỉnh đề tài. <br/><i class='fa-solid fa-caret-right'></i> Cuối giai đoạn này, học viên đăng ký tên đề tài chính thức và kế hoạch nghiên cứu. Sau khi đăng ký chính thức thì không được phép thay đổi đề tài nghiên cứu, trừ trường hợp học lại từ đầu",
                    link: "",
                },
                {
                    name: "Giai đoạn 3: Nghiên cứu cùng với sự hướng dẫn trực tiếp (1-1)",
                    description:
                        "<b>Khoảng 18 tháng</b> <br/> Có 12 session, mỗi session kéo dài 6 tuần. <br/><i class='fa-solid fa-caret-right'></i> Cuối mỗi session cần có báo cáo tiến độ thực hiện bài viết.<br/><i class='fa-solid fa-caret-right'></i> Được gặp giảng viên tối đa 2 giờ/tháng <br/><i class='fa-solid fa-caret-right'></i> Cuối giai đoạn, học viên hoàn thành toàn bộ bài viết. Bài viết được đánh giá ĐẠT hoặc VIẾT LẠI <br/> *Nếu giai đoạn này, học viên muốn đổi đề tài sẽ quay ngược lại về giai đoạn 01 Bài Thesis hoàn chỉnh cần 50.000 từ, khoảng 200 – 250 trang (không bao gồm trang bìa)",
                    link: "",
                },
                {
                    name: "Giai đoạn 4: Bảo vệ luận văn tốt nghiệp",
                    description:
                        "<b>Khoảng 3 tháng</b> <br/> Nếu giai đoạn 3 được đánh giá ĐẠT, học viên được đăng ký bảo vệ và nộp file PPT",
                    link: "",
                },
            ],
        },
        IDEAS06: {
            pay_rule: `
       <img src="https://ideas.edu.vn/wp-content/new_public/data_imgs/icon2.png"/>
        <p><b>Thanh toán một lần hoặc chia thành 4 lần</b></p>
      <ul>
        <li><b><i class="fa-solid fa-file-invoice-dollar"></i> Học viên thanh toán 1 lần được trợ phí 20% từ Viện IDEAS</b></li>
        <li><i class="fa-solid fa-file-invoice-dollar"></i> <b>Hoặc thanh toán 4 lần chia thành các đợt: 40%, 20%, 20%, 20% </b></li>
        <li><br/></li>
        <li><b class="main_clr">Hình thức thanh toán</b></li>
        <li><i class="fa-solid fa-check"></i> Thanh toán trực tiếp tại Viện IDEAS</li>
        <li><i class="fa-solid fa-check"></i> Chuyển khoản trực tuyến qua thông tin số tài khoản được cung cấp trong hợp đồng tư vấn hoặc qua đường link Payoo. </li>
        <li><i class="fa-solid fa-check"></i> Viện IDEAS cung cấp phiếu thu hộ học phí (Khi thanh toán trực tiếp hoặc cà thẻ trực tiếp) hoặc email xác nhận đóng học phí mà học viên đã đóng sau khoảng 01 ngày làm việc. Trường hợp học viên đóng phí vào ngày nghỉ cuối tuần, nghỉ lễ, email xác nhận đóng phí sẽ được Viện thực hiện vào ngày làm việc liền kề sau ngày nghỉ. Khoản phí thu hộ không thể xuất hóa đơn VAT theo quy định của Nhà nước Việt Nam.</li>
        </ul>
      `,
            benefits: [
                "Mang lại lợi thế cạnh tranh vượt trội, vì học viên DBA không chỉ am hiểu sâu sắc trong lĩnh vực chuyên môn mà còn được trang bị các kỹ năng quản lý nâng cao dành cho cấp lãnh đạo cao nhất.",
                "Kích thích tư duy học thuật và phát triển trí tuệ, rèn luyện khả năng tư duy chiến lược và phân tích ở cấp độ cao.",
                "Khác biệt trong đám đông, thăng tiến trong sự nghiệp nắm bắt các xu hướng mới nhất, lý thuyết hiện đại và những vấn đề thời sự trong quản trị và kinh doanh.",
                "Viện IDEAS hỗ trợ: hệ thống IDEAS – LMS & lớp chuyên đề bổ trợ vào các ngày Chủ nhật, có hướng dẫn bài tập và đánh giá sơ bộ bài Final exam.",
            ],
            program_name_degree: "Dual DBA",
            program_benefits_degree: [
                "Tấm bằng DBA, cấp độ cao nhất của học vị, từ một trường kinh doanh lớn, danh tiếng và campus trãi dài rộng khắp thế giới.",
                "Tân Tiến Sĩ của trường Ascencia Business School đánh dấu cột mốc cực kỳ quan trọng trên con đường phát triển.",
                "Là một chuyên gia thực thụ có đầy đủ các kỹ năng lãnh đạo cần thiết để thúc đẩy sự thay đổi lớn trong lĩnh vực của bạn.",
            ],
            link_iframe:
                "https://ideas.edu.vn/wp-content/uploads/2025/10/Dual-DBA.webp",
            listImgs: [
                "https://i.ytimg.com/vi/2FtdKP2bf00/maxresdefault.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/03/ShareImage-1.jpg",
                "https://i.ytimg.com/vi/vJNu-g2vBg4/maxresdefault.jpg",
                "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT5c9vyalfHcxNNvOrudO4IQ9qGHz8PC0GhVw&s",
                "https://i.ytimg.com/vi/hOC3ISbaQdQ/maxresdefault.jpg",
                "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSCqFyt8JNQRbNF3Ut_mX_AVxvNgcviFQyxsQ&s",
            ],
            level: "DBA",
            avatar: "https://ideas.edu.vn/wp-content/uploads/2025/10/Dual-DBA.webp",
            name: "Dual DBA",
            highlight: [
                "Trực tuyến 100%",
                "DBA",
                "Nghiên cứu với cố vấn",
                "2 buổi chuyên đề/môn (Chủ nhật)",
            ],
            school: "Estiam & RB College",
            country: "Anh - Pháp",

            subjects: "<b>4</b> giai đoạn | <b>2.5 - 3</b> năm - 1 luận văn",
            duration: "2.5 - 3 năm",
            tagline: "Nhận bằng DBA Anh và Pháp của Estiam và RB College",
            link: "/dual-dba-estiam-rb",
            experience: [
                "Bằng và bảng điểm Thạc sĩ hoặc tương đương.",
                "Có chứng chỉ IELTS 6.0/TOEFL 60 hoặc bằng chứng khác thể hiện năng lực tiếng Anh",
            ],
            // test: [
            //   "Chương trình học tập, làm bài và nộp trên flatform của trường, dựa trên tài liệu và hướng dẫn của Giáo sư",
            //   "Kiến thức quản trị chuyên sâu, kết hợp với case study thực tiễn",
            //   "Thời gian học tập tự sắp xếp linh hoạt",
            // ],
            fee_plane: "4,400",
            fee_course: [
                {
                    name: "High Quality",
                    icon: "https://ideas.edu.vn/wp-content/new_public/data_imgs/icon5.png",
                    price: "12.500 Euro",
                    benefits: [
                        "Trợ phí <b class='main_clr'>3,000 EURO</b> cho cựu học viên khi đăng ký chương trình",
                        "Hệ thống LMS hỗ trợ: ứng dụng I-AI để hỗ trợ trong quá trình học tập.",
                        "Thời gian nghiên cứu: 2.5 – 4 năm.",
                        "Trợ lý chương trình nhắc deadline, hỗ trợ hệ thống, kết nối giảng viên qua Group Zalo/Email.",
                        "Tự nghiên cứu với sự định hướng và hướng dẫn của Giáo sư.",

                        "Đánh giá sơ bộ bài Final: Được hội đồng chuyên môn của Viện IDEAS đánh giá, góp ý bài Final đã đi đúng hướng, tránh lạc đề, học viên nắm được điểm đánh giá sơ bộ và hạn chế được khả năng rớt môn.",
                    ],
                },
            ],

            description:
                "Bằng DBA là bằng cấp tiến sĩ trong lĩnh vực quản trị kinh doanh. Chương trình này dành cho các chuyên gia giàu kinh nghiệm muốn nâng cao kiến ​​thức, kỹ năng và chuyên môn trong lĩnh vực lãnh đạo, nghiên cứu và quản lý kinh doanh.",
            demographic: {
                jobs: [
                    {
                        jobname: "Quản trị kinh doanh",
                        percent: 30,
                    },
                    {
                        jobname: "Ngân hàng",
                        percent: 22,
                    },
                    {
                        jobname: "Công nghệ thông tin",
                        percent: 20,
                    },
                    {
                        jobname: "Start-up",
                        percent: 16,
                    },
                    {
                        jobname: "Khác",
                        percent: 12,
                    },
                ],
                ages: [
                    {
                        jobname: "18 - 24",
                        percent: 7,
                    },
                    {
                        jobname: "25 - 30",
                        percent: 27,
                    },
                    {
                        jobname: "31 - 40",
                        percent: 55,
                    },
                    {
                        jobname: "41 - 50",
                        percent: 10,
                    },
                    {
                        jobname: "51+",
                        percent: 1,
                    },
                ],
            },
            degree: {
                front:
                    "https://ideas.edu.vn/wp-content/uploads/2025/10/Estiam-DBA-2.webp",
                back: "https://ideas.edu.vn/wp-content/uploads/2025/10/RB-DBA-2.webp",
            },
            accreditation: [
                {
                    name: "Công nhận và Kiểm định",
                    logo: "https://ideas.edu.vn/wp-content/uploads/2025/10/DUAL-DEGREE-2.webp",
                    link: "#",
                },
                {
                    name: "Công nhận và Kiểm định",
                    logo: "https://ideas.edu.vn/wp-content/uploads/2025/10/DUAL-DEGREE-1.webp",
                    link: "#",
                },
                {
                    name: "Công nhận và Kiểm định",
                    logo: "https://ideas.edu.vn/wp-content/uploads/2025/10/DUAL-DEGREE-3.webp",
                    link: "#",
                },
                {
                    name: "Công nhận và Kiểm định",
                    logo: "https://ideas.edu.vn/wp-content/uploads/2025/10/DUAL-DEGREE-5.webp",
                    link: "#",
                },
                {
                    name: "Công nhận và Kiểm định",
                    logo: "https://ideas.edu.vn/wp-content/uploads/2025/10/DUAL-DEGREE.webp",
                    link: "#",
                },
                {
                    name: "Công nhận và Kiểm định",
                    logo: "https://ideas.edu.vn/wp-content/uploads/2025/10/DUAL-DEGREE4.webp",
                    link: "#",
                },
                {
                    name: "Công nhận và Kiểm định",
                    logo: "https://ideas.edu.vn/wp-content/uploads/2025/10/Erasmus_Logo.svg.webp",
                    link: "#",
                },
            ],
            require: [
                "Giấy tờ tùy thân: Bản scan trang đầu hộ chiếu, Ảnh hộ chiếu (4×6)",
                "Bằng và bảng điểm: Xác nhận đã có bằng Thạc sĩ hoặc tương đương.",
                "Trình độ tiếng Anh: Có chứng chỉ IELTS 6.0/TOEFL 60 hoặc bằng chứng khác thể hiện năng lực tiếng Anh.",
                "Thư bày tỏ nguyện vọng: Viết khoảng 250 từ, thể hiện mục tiêu và lý do chọn chương trình.",
                "CV chi tiết: Mô tả kinh nghiệm học tập và làm việc chuyên môn.",
                "Thư giới thiệu: Hai thư giới thiệu từ trường học hoặc cơ quan nơi ứng viên đã từng học tập, công tác.",
                "Application Form <a href='https://ideas.edu.vn/wp-content/uploads/2025/10/Application-Form-.docx' target='_blank' class='text_download'>(Download Here)</a>",
            ],
            faq: [
                {
                    q: "Chưa có kinh nghiệm nghiên cứu có thể theo học chương trình Dual DBA không?",
                    a: "Có. Chương trình Dual DBA được thiết kế dành cho các nhà quản lý, lãnh đạo muốn nâng cao tư duy chiến lược và năng lực nghiên cứu ứng dụng trong kinh doanh. Viện IDEAS cung cấp hướng dẫn chi tiết về phương pháp nghiên cứu, giúp học viên từng bước xây dựng luận án DBA mà không cần nền tảng nghiên cứu trước đó.",
                },
                {
                    q: "Nếu bận đi công tác không thể hoàn thành bài đúng hạn thì sao?",
                    a: "Chương trình Dual DBA được thiết kế linh hoạt để phù hợp với lịch trình bận rộn của học viên. Mỗi môn học đều có thời gian nghiên cứu cùng với giáo viên cố vấn. Deadline các bài tập thường vào lúc buổi tối Việt Nam. Học viên nắm được thông tin bài tập và deadline sẽ sắp xếp phù hợp. Trường hợp Học viên chưa thể hoàn thành đúng thời hạn sẽ được đăng ký <b>Resubmit</b> có tốn phí để được mở thêm 1 tuần nộp lại bài. ",
                },
                {
                    q: "Học viên có thể tham gia lễ tốt nghiệp tại Paris - Pháp không?",
                    a: "Có. Học viên hoàn thành chương trình có thể đăng ký tham gia lễ tốt nghiệp tại Pháp, cùng với các học viên quốc tế khác của Ascencia Business School. Mỗi năm có 2 đợt Lễ Tốt nghiệp vào tháng 6 và tháng 12. Viện IDEAS sẽ thông báo đến học viên về lịch thông báo từ Trường để học viên đăng kí.",
                },
            ],
            this_subjects: [
                {
                    name: "Giai đoạn 1: Lợi thế cạnh tranh",
                    description:
                        "<b>Khoảng 12 tháng</b> <br/> Tham dự 6 buổi seminar (mỗi buổi từ 2–3 giờ) cùng với các buổi hướng dẫn cá nhân 1:1. <br/> Soạn thảo đề cương luận án (thesis proposal) một cách toàn diện.",
                    link: "",
                },
                {
                    name: "Giai đoạn 2: Lựa chọn Giáo sư hướng dẫn",
                    description:
                        "<b>Khoảng 3 tháng</b> <br/>  Lựa chọn giảng viên hướng dẫn từ IDEAS hoặc Estiam (có phí). <br/> Hoàn thiện và chốt đề cương cùng kế hoạch nghiên cứu. <br/> Kết thúc giai đoạn: Đăng ký đề tài chính thức.",
                    link: "",
                },
                {
                    name: "Giai đoạn 3: Nghiên cứu cùng với sự hướng dẫn trực tiếp (1-1)",
                    description:
                        "<b>Khoảng 15 - 18 tháng</b> <br/> Nộp báo cáo tiến độ định kỳ. <br/> Hoàn thành toàn bộ luận án với độ dài khoảng 50.000 từ (200–250 trang).",
                    link: "",
                },
                {
                    name: "Giai đoạn 4: Bảo vệ luận văn tốt nghiệp",
                    description:
                        "<b>Khoảng 3 tháng</b> <br/> Hoàn thiện toàn bộ luận án và bảo vệ trước Hội đồng chấm luận văn.",
                    link: "",
                },
            ],
        },
        IDEAS07: {
            benefits: [
                "Các lớp học tương tác trực tuyến với giảng viên nước ngoài. Nâng cao khả năng, tự tin giao tiếp, trao đổi với Giáo sư và giải quyết các vấn đề thực tiễn trong doanh nghiệp.",
                "Công nghệ chatbox I-AI hỗ trợ các nội dung phù hợp trong chương trình MBA online do Viện IDEAS quản lý. Trợ lý chương trình hỗ trợ nhắc nhở deadline bài tập, các vấn đề liên quan đến hệ thống, kết nối.",
                "Viện IDEAS hỗ trợ: hệ thống IDEAS – LMS & lớp chuyên đề bổ trợ vào các ngày Chủ nhật, có hướng dẫn bài tập và đánh giá sơ bộ bài Final exam.",
                "Lễ tốt nghiệp và chuyến đi học tập tại trụ sở chính của trường – Geneva Thụy Sĩ.",
            ],
            program_name_degree: "Bachelor of Business Administration",
            program_benefits_degree: [
                "Tấm bằng Cử nhân danh giá được trao từ một trường đại học lâu đời và danh tiếng.",
                "Là cựu học viên của trường Swiss UMEF, tân Cử nhân đánh dấu cột mốc quan trọng trên con đường phát triển.",
                "Mở rộng con đường học lên Thạc sĩ - Tiến sĩ và phát triển sự nghiệp trong tương lai",
            ],
            link_iframe:
                "https://www.youtube.com/embed/ZrLeuFGGXQI?si=0tiJvbnRDzwEyo3B",
            listImgs: [
                "https://ideas.edu.vn/wp-content/uploads/2025/11/ltnumef10202501.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/11/DSC_9177.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/11/DSCF6555.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/11/DSCF6740.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/11/DSCF6777.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/03/NHP_4768.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/03/NHP_4712.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/03/NHP_4367.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/03/NHP_4528.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/03/NHP_4783.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/03/NHP_4447.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/03/NHP_4356.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/03/NHP_4861.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/03/NHP_4840.jpg",
                "https://ideas.edu.vn/wp-content/uploads/2025/03/NHP_4799.jpg",
            ],
            level: "MBA",
            avatar: "https://ideas.edu.vn/wp-content/uploads/2026/02/TOPUP.webp",
            name: "TOP-UP BBA",
            school: "Swiss UMEF",
            subjects: "<b>60</b> tín chỉ ECTS - <b>10</b> môn và capstone",
            duration: "12 tháng",
            country: "Thuỵ Sĩ",
            experience: [
                "Tốt nghiệp cao đẳng/trung cấp - Đại học năm 2",
                "Tiếng Anh giao tiếp tốt hoặc bằng cấp tương đương IELTS 6.0",
            ],
            test: {
                high: [
                    "Lớp học tương tác trực tiếp, được trao đổi và thảo luận cùng Giảng viên và học viên",
                    "Kiến thức hướng đến thực hành giải quyết các vấn đề quản lý chuyên sâu",
                    "Lộ trình học tinh gọn 10 môn - không làm luận văn",
                    "Học phí linh hoạt chia nhỏ hoặc trả góp",
                ],
                stand: [
                    "Thời gian học tập, nghiên cứu tự sắp xếp linh hoạt, hỗ trợ bởi các giảng viên Việt Nam trong quá trình học",
                    "Kiến thức hướng đến thực hành giải quyết các vấn đề quản lý chuyên sâu",
                    "Lộ trình học tinh gọn 10 môn - không làm luận văn",
                    "Học phí linh hoạt chia nhỏ hoặc trả góp",
                ],
            },
            highlight: [
                "Trực tuyến 100%",
                "Liên thông lên Cử nhân",
                "20:00 - 23:00 (Vietnam)",
                "2 buổi chuyên đề/môn (Chủ nhật)",
            ],
            tagline:
                "Đại học tư thục đầu tiên tại Geneva đạt kiểm định liên bang cao nhất Thuỵ Sĩ - Swiss Accreditation Council",
            link: "/swiss-umef-top-up-bba",
            description:
                "Chương trình liên thông lên Cử nhân trong 1 năm đào tạo liên thông trực tuyến Cử nhân Quản trị Kinh doanh, đừng để tấm bằng Cử nhân là rào cản trước mọi con đường thăng tiến của bạn!",
            demographic: {
                jobs: [
                    {
                        jobname: "Quản trị kinh doanh",
                        percent: 30,
                    },
                    {
                        jobname: "Ngân hàng",
                        percent: 22,
                    },
                    {
                        jobname: "Công nghệ thông tin",
                        percent: 20,
                    },
                    {
                        jobname: "Start-up",
                        percent: 16,
                    },
                    {
                        jobname: "Khác",
                        percent: 12,
                    },
                ],
                ages: [
                    {
                        jobname: "18 - 24",
                        percent: 7,
                    },
                    {
                        jobname: "25 - 30",
                        percent: 27,
                    },
                    {
                        jobname: "31 - 40",
                        percent: 55,
                    },
                    {
                        jobname: "41 - 50",
                        percent: 10,
                    },
                    {
                        jobname: "51+",
                        percent: 1,
                    },
                ],
            },
            degree: {
                back: "https://ideas.edu.vn/wp-content/uploads/2025/11/Sample_page-0002.webp",
                front: "https://vtci.edu.vn/wp-content/uploads/2025/07/bba-degree.jpg",
                transcript:
                    "https://ideas.edu.vn/wp-content/uploads/2025/11/Sample_page-0003.webp",
            },
            // fee_plane: "3,000",
            fee_course: [
                // {
                //   name: "Standard",
                //   icon: "https://ideas.edu.vn/wp-content/new_public/data_imgs/icon6.png",
                //   price: "2.900 CHF",
                //   benefits: [
                //     "<b>Dành cho học viên đăng ký từ 01/08/2025:</b> Trợ phí từ trường giảm <b>500 CHF</b>.",
                //     "Tài khoản truy cập tài liệu học tập, môn học theo chương trình gốc của trường.",
                //     "Trợ lý chương trình nhắc deadline, hỗ trợ hệ thống, kết nối giảng viên qua Group Zalo/Email.",
                //     "I-AI: Chatbot hỗ trợ nội dung và giải đáp thắc mắc (Viện IDEAS).",
                //     "Lớp chuyên đề của Viện IDEAS tổ chức 2 ngày Chủ nhật vào tuần thứ 2 và thứ 4 mỗi môn, từ 8h30 - 11h30 và 13h30 - 16h30, nhằm giúp kiểm tra và hướng dẫn hoàn thành bài Final Exam.",
                //   ],
                // },
                {
                    name: "TOP-UP BBA",
                    icon: "https://ideas.edu.vn/wp-content/new_public/data_imgs/icon5.png",
                    price: "3.000 CHF",
                    // price_promo: "4.165 CHF",
                    benefits: [
                        "Hỗ trợ trả góp 12 tháng qua <b class='main_clr'>Sacombank</b>",
                        "Ứng dụng công nghệ - Platform Ai cho học tập do IDEAS phát triển",
                        "Lớp học GVNN vào các buổi tối trong tuần (tùy chọn)",
                        "Lịch học: mỗi môn học kéo dài 04 tuần, mỗi tuần có 02 buổi tối học với giảng viên nước ngoài của trường (lịch dự kiến rơi vào tối thứ 3 và tối thứ 5, mỗi buổi từ 2-3 tiếng, từ 20h00 - 22h00)",
                        // "Bao gồm 2 chuyến đi Thụy sĩ ( 03 ngày lưu trú, phí học tập/LTN, di chuyển nội bộ  Thụy sĩ).",
                        "Đánh giá sơ bộ bài Final: Được hội đồng chuyên môn của Viện IDEAS đánh giá, góp ý bài Final đã đi đúng hướng, tránh lạc đề, học viên nắm được điểm đánh giá sơ bộ và hạn chế được khả năng rớt môn.",
                    ],
                },
            ],
            accreditation: [
                {
                    name: "Công nhận và Kiểm định",
                    logo: "https://ideas.edu.vn/wp-content/new_public/data_imgs/kdumef1.png",
                    link: "#",
                },
                {
                    name: "Công nhận và Kiểm định",
                    logo: "https://ideas.edu.vn/wp-content/new_public/data_imgs/kdumef3.png",
                    link: "#",
                },
                {
                    name: "Công nhận và Kiểm định",
                    logo: "https://ideas.edu.vn/wp-content/new_public/data_imgs/kdumef4.png",
                    link: "#",
                },
                {
                    name: "Công nhận và Kiểm định",
                    logo: "https://ideas.edu.vn/wp-content/new_public/data_imgs/kdumef5.png",
                    link: "#",
                },
                {
                    name: "Công nhận và Kiểm định",
                    logo: "https://ideas.edu.vn/wp-content/uploads/2023/12/vnanric.jpg",
                    link: "#",
                },
                {
                    name: "Công nhận và Kiểm định",
                    logo: "https://ideas.edu.vn/wp-content/new_public/data_imgs/kdumef2.png",
                    link: "#",
                },
            ],
            require: [
                "Bằng cao đẳng hoặc bảng điểm đại học",
                "Sơ yếu lí lịch (CV)",
                "Thư động lực (Motivation Letter)",
                "Ảnh hộ chiếu (4×6)",
                "Passport",
                "Tiếng anh tương đương IELTS 6.0 hoặc có thể phỏng vấn đầu vào với đại diện của trường tại Việt Nam",
                "<b class='main_clr'>*</b>Tham khảo chương trình PRE-TOP UP nếu bạn chưa đủ điều kiện <a href='#' target='_blank' class='text_download'>PRE TOP-UP</a>",
            ],
            faq: [
                {
                    q: "Chương trình Liên thông có yêu cầu bảo vệ luận văn không?",
                    a: "Không. Chương trình liên thông Cao đẳng - Cử nhân của Swiss UMEF bao gồm 10 môn học và không yêu cầu bảo vệ luận văn chỉ cần làm Capstone Project tập trung vào việc nâng cao kỹ năng quản lý thực tiễn.",
                },
                {
                    q: "Lễ tốt nghiệp sau khi hoàn thành Top up sẽ được tổ chức ở đâu, có thể qua Trường không?",
                    a: "Sau khi hoàn thành chương trình Top up BBA, học viên sẽ được tham gia lễ tốt nghiệp do Swiss UMEF tổ chức. Thông thường, lễ tốt nghiệp sẽ diễn ra tại Geneva, Thụy Sĩ, nơi đặt trụ sở chính của Trường. Tuy nhiên, Swiss UMEF cũng có thể tổ chức buổi lễ tốt nghiệp tại Việt Nam hoặc các địa điểm khác tùy theo số lượng học viên và điều kiện tổ chức. Học viên có thể lựa chọn tham dự lễ tốt nghiệp tại Geneva hoặc tại địa điểm do Viện IDEAS phối hợp tổ chức.",
                },
                {
                    q: "Sau khi hoàn thành chương trình Top up BBA, có thể học lên Thạc sĩ không?",
                    a: "Có, sau khi hoàn thành chương trình Top up BBA của Swiss UMEF, học viên có thể tiếp tục học lên chương trình Thạc sĩ Quản trị Kinh doanh (MBA – Master of Business Administration) tại các trường đại học hoặc tổ chức giáo dục phù hợp.",
                },
            ],
            this_subjects: [
                {
                    name: "Introduction to Management",
                    description:
                        "This course progressively builds on marketing issues by exploring more advanced topics and strategic planning in the marketing concept. Our attention will be drawn to laying the groundwork by strategically planning all the marketing approaches and analyzing the external and internal environment of the organization. <br/><br/> This course also examines the dynamic environment inhabited by today's marketers, helping students understand the marketplace and integrate the appropriate information into marketing decisions. The course focuses on an integrated approach and strategy-based actions, covering only those critical and advanced issues required to succeed in future professional work. <br/><br/> Additionally, our focus includes the concept of marketing, the marketing manager's job, the development of a marketing strategy, marketing research, consumer behavior and analysis, organizational buying behavior; market structure and competitor analysis; marketing mix decision-making; communications and advertising strategy; channels of distribution; the personal sales channel; pricing; sales promotion; strategies for service markets; strategies for technology-based markets; global marketing strategies; and new product development",
                    link: "",
                    credit: 6,
                },
                {
                    name: "Introduction to Finance",
                    description:
                        "This course is designed to provide a fresh approach to management students, based on dynamic, real-life organizational events confronting both human resource managers and line managers who often implement personnel programs and policies. <br/><br/> Human Resource Management takes a managerial orientation and is viewed as being relevant to managers in every unit, project or team. Managers are constantly faced with human relation management issues, problems and decision making. <br/><br/>  This course will introduce management students to HR activities (recruitment and selection, training and development, reward management and performance appraisal) with the emphasis that it is the bundles of HR interventions and not single practices that develop effective human resources. Based on realistic, current trends confronting managers, this course will also expose the management students to contemporary issues, such as, employee engagement and organizational change, and how HR can work together with knowledge management, technology, internationalization - and talent management - to further develop the effectiveness of human resources and help create, develop and sustain a high-performing organization",
                    link: "https://youtu.be/CebD5PCML6w?si=qbXiR8r9eztjvUvM",
                    credit: 6,
                },
                {
                    name: "Organisational Behaviour",
                    description:
                        "This course explores the principles and practices of entrepreneurship and innovation. Students will learn how to identify and evaluate entrepreneurial opportunities, develop innovative ideas, and create viable business models. The course emphasizes critical thinking, creativity, and problem-solving skills necessary for successful entrepreneurship. Students will also gain an understanding of the challenges and strategies involved in launching and growing a new venture in a dynamic business environment",
                    link: "https://youtu.be/t1g7aCRoC-I?si=5luqjqunPivUr5wL",
                    credit: 6,
                },
                {
                    name: "Global Marketing",
                    description:
                        "This course systematically unfolds crucial issues in corporate finance management at graduate level. We review the introductory aspect of the course, and build from there toward approaches of investment appraisals, explaining details as regards the methods like compound interest, net present value decision rule and the internal rate of return. Additionally, methods such as the annuities and perpetuities, sinking fund and discounted cash flows and tax payments would be fully discussed. <br/><br/> Issues in capital rationing and risk analysis are discussed under certain market conditions, considering the constraint, sensitivity analysis. <br/><br/> Our study efforts will also consider portfolio theory and capital asset pricing model, which is an important aspect of corporate financial management, together with the capital budgeting model and the associated specific tools used in portfolio theory and pricing decision. <br/><br/> Other topics such as market share value and pricing would be examined to give students advanced knowledge of the company‘s worth. We further go on to dividend decision, which is the crux of cash management concern, as against retained earning for futures operations and the rule of safety thumps",
                    link: "https://youtu.be/zk1-2CERWHs?si=tT-pLAUoA5iI_b3h",
                    credit: 6,
                },
                {
                    name: "AI in Business",
                    description:
                        "This course is designed to provide students with an understanding of the interplay between politics, economics, and geography in shaping international relations. Students will learn about the key concepts and theories of geopolitics and geoeconomics, as well as their practical applications in contemporary world affairs",
                    link: "",
                    credit: 6,
                },
                {
                    name: "Project Management",
                    description:
                        "The course will deepen the student’s comprehension of the digital transformation that is pervading society. The course will examine the process that contributes to the transitions to a digital society and economy. Therefore, digitalization is having an impact on different levels, affecting structures and the strategies of the organization, their ability to respond to external stimuli, the interactions with the stakeholders and the definition of the value proposition. Hence, the Digital transformation course aims also to support the students to understand the problems that the digital transformation might arise and, at the same time, to assess the new opportunities that the digitalization produces",
                    link: "",
                    credit: 6,
                },
                {
                    name: "Innovation & Design Thinking",
                    description:
                        "This course introduces the key concepts, tools, and principles of strategy formulation and competitive analysis. It is concerned with managerial decisions and actions that affect the performance and survival of business enterprises. The course is focused on the information, analyses, organizational processes, and skills and business judgment managers must use to devise strategies, position their businesses, define firm boundaries and maximize long-term profits in the face of uncertainty and competition.  The course takes a general management perspective, viewing the firm as a whole, and examining how policies in each functional area are integrated into an overall competitive strategy. The key strategic business decisions of concern in this course involve choosing competitive strategies, creating competitive advantages, taking advantage of external opportunities, securing and defending sustainable market positions, and allocating critical resources over long periods. Decisions such as these can only be made effectively by viewing a firm holistically, and over the long term",
                    link: "https://youtu.be/wVY3uLMG-Fk?si=rTdwcjAk6-tEgbqS",
                    credit: 6,
                },
                {
                    name: "Total Quality Management",
                    description:
                        "Project management is a key contributor to organizational success and business results. This course teaches the fundamentals of project management. Students will learn how to select projects (portfolio management), lead and manage projects, build project teams, handle project risks, manage costs and schedules, control project progress, terminate projects, and integrate sustainability considerations throughout the project life cycle",
                    link: "https://youtu.be/MMYVUtpiAPk?si=R1XbXLyILON4-yK6",
                    credit: 6,
                },
                {
                    name: "Change Management",
                    description:
                        "This course provides a comprehensive understanding of supply chain management, covering the key concepts, strategies, and practices involved in managing the flow of goods and services from suppliers to end customers. Students will explore various aspects of supply chain management, including procurement, logistics, inventory management, demand forecasting, and supplier relationships. The course aims to develop students' skills in designing, optimizing, and coordinating supply chain activities to achieve competitive advantage and operational excellence",
                    link: "",
                    credit: 6,
                },
                {
                    name: "Management Information Systems",
                    description:
                        "This course approaches the Cross-Cultural Leadership from an organisational perspective, where individuals from different cultures, religions, and educational backgrounds interact on a daily basis. The organisation, where decisions are made collectively, promote people interactions and responsibilities incorporating the sense of importance of multiculturalism into its strategic vision. <br/><br/>  This course aims to develop an easily applied and solid rule to identify cross-cultural differences within the organisation that can create robust boundaries and link them to the effective attainment of group goals. At the same time, the course observes real-life cases where meaningful differences exist but address appropriately through leadership of cultural diversity",
                    link: "",
                    credit: 6,
                },
                {
                    name: "Capstone Project",
                    description: "...",
                    link: "",
                    credit: 6,
                },
            ],
        },
    },
    graduation_ceremony: [
        {
            title: "Lễ tốt nghiệp",
            location: "Tp. Hồ Chí Minh",
            avatar:
                "https://ideas.edu.vn/wp-content/uploads/2026/01/ltn27122025.webp",
            school: "Swiss UMEF",
            name: "MBA/EMBA",
            time: "27/12/2025",
            link: "https://www.facebook.com/ideas.edu.vn/posts/pfbid034nzCDGcFVfz54M62b4Yod9iJ3mMx2eVNMXB33PpDeDSw6Xw1cZsH4oucpX2TogDcl?locale=vi_VN",
        },
        {
            title: "Lễ tốt nghiệp",
            location: "Geneva - Thụy Sĩ",
            avatar:
                "https://ideas.edu.vn/wp-content/uploads/2025/11/ltnumef10202501.webp",
            school: "Swiss UMEF",
            name: "MBA/EMBA/MSc AI",
            time: "29/10/2025",
            link: "http://ideas.edu.vn/chuyen-di-thang-10-2025",
        },
        {
            title: "Lễ tốt nghiệp",
            location: "Eden Star Hotel - HCMC",
            avatar: "https://ideas.edu.vn/wp-content/uploads/2025/07/ltn72025.webp",
            school: "Ascencia Business School",
            name: "Global MBA - DBA",
            time: "26/07/2025",
            link: "https://ideas.edu.vn/wp-content/uploads/2025/07/ltn72025.webp",
        },
        {
            title: "Lễ tốt nghiệp",
            location: "Paris - Pháp",
            avatar:
                "https://ideas.edu.vn/wp-content/uploads/2025/08/quangnon_cdp.webp",
            school: "Ascencia Business School",
            name: "Global MBA - DBA",
            time: "02/07/2025",
            link: "https://www.facebook.com/ideas.edu.vn/posts/pfbid02imDSb2CKDPVgKCQtkQTfihwpayYVVjuunvfDfRWfxTMstTD661BnZmYygnTwt9wpl?locale=vi_VN",
        },
        {
            title: "Lễ tốt nghiệp",
            location: "Viện IDEAS - Việt Nam",
            avatar:
                "https://ideas.edu.vn/wp-content/uploads/2024/11/8X1A9328-1-1.jpg",
            school: "Ascencia Business School",
            name: "Global MBA - DBA",
            time: "23/11/2024",
            link: "https://youtu.be/hmVxOq5jkeM?si=gR-YOgFi2KQJftr9",
        },
        {
            title: "Lễ tốt nghiệp",
            location: "Viện IDEAS - Việt Nam",
            avatar:
                "https://ideas.edu.vn/wp-content/uploads/2024/10/Totnghiepumef.jpg",
            school: "Swiss UMEF",
            name: "EMBA & Online MBA",
            time: "26/10/2024",
            link: "https://youtu.be/fBf5YcaMxDY?si=eJDfqKWc4HxT_TmS",
        },
        {
            title: "Lễ tốt nghiệp",
            location: "Paris - Pháp",
            avatar: "https://ideas.edu.vn/wp-content/new_public/data_imgs/image.png",
            school: "Ascencia Business School",
            name: "Global MBA - DBA",
            time: "18/07/2024",
            link: "https://www.facebook.com/share/r/14UHtxBTZQ/",
        },
        {
            title: "Lễ tốt nghiệp",
            location: "Viện IDEAS - Việt Nam",
            avatar:
                "https://ideas.edu.vn/wp-content/uploads/2024/01/416256674_837845658141991_5379123310787471174_n.jpg",
            school: "Ascencia Business School",
            name: "Global MBA - DBA",
            time: "06/01/2024",
            link: "https://youtu.be/Dc78ClToNRo?si=kfg00KZ6gYpOWwTI",
        },
    ],
    student_quote: [
        {
            name: "Nguyễn Thanh Bình",
            title:
                "Tiến sĩ QTKD Pháp – Ascencia Business School - Director of Information & Environment technology application Institute",
            avatar: "https://ideas.edu.vn/wp-content/uploads/2025/02/casc1.jpg",
            content:
                "Cảm ơn sự hỗ trợ rất nhiệt tình của đội ngũ cán bộ và nhân viên của Viện IDEAS, đã đồng hành cùng chúng tôi trong suốt quá trình nghiên cứu, hỗ trợ không quản ngày đêm để chúng tôi hoàn thành mục tiêu nghiên cứu Tiến Sĩ – cấp bậc cao nhất của Học vị",
        },
        {
            name: "Nguyễn Huỳnh Phương",
            title:
                "Thạc Sĩ QTKD Pháp (Global MBA) – Ascencia Business School - UNIT MANAGER in Hanwha Life Việt Nam",
            avatar: "https://ideas.edu.vn/wp-content/uploads/2025/02/huynhphuong.jpg",
            content:
                "Đối với những bạn chọn chương trình trực tuyến, tôi khuyên bạn nên chọn nơi đáng tin cậy như Viện IDEAS. Bạn nên chia sẻ mọi căng thẳng hoặc khó khăn với giảng viên vì họ sẽ đưa ra những gợi ý hữu ích để giúp bạn vượt qua những khó khăn đó",
        },
        {
            name: "Nguyễn Thị Hà Miên",
            title:
                "Thạc Sĩ QTKD Pháp (Global MBA) – Ascencia Business School - Deputy Project Manager",
            avatar: "https://ideas.edu.vn/wp-content/uploads/2025/02/hamien.jpg",
            content:
                "Tôi chọn chương trình trực tuyến vì nó linh hoạt hơn. Bên cạnh đó, sự hỗ trợ 24/7 của Viện IDEAS đã giúp tôi hoàn thành tốt nhất về thời hạn nộp bài tập liên tục cũng như nhắc nhở thường xuyên về lớp học",
        },
        {
            name: "Lê Ngọc Thương",
            title:
                "Thạc Sĩ QTKD Thụy Sĩ (Executive MBA) – Swiss UMEF Head of Commercial Operations – Boehringer Ingelheim",
            avatar: "https://ideas.edu.vn/wp-content/uploads/2025/02/cumef.jpg",
            content:
                " Chương trình đã kết nối tôi với nhiều bạn cùng lớp ở các ngành nghề khác nhau, giúp tôi tiếp nhận những chia sẻ và kinh nghiệm quý báu. Tôi đặc biệt cảm ơn Viện IDEAS vì sự hỗ trợ suốt 1 năm qua, từ kiến thức chuyên gia đến hỗ trợ hành chính 24/7, giúp tôi cân bằng việc học và công việc để đạt được mục tiêu",
        },
        {
            name: "Lê Chí Thành",
            title:
                "Tiến sĩ QTKD Pháp – Ascencia Business School - Channel Business Manager (Indochina) | Leica Biosystems (an OpCo of Danaher)",
            avatar: "https://ideas.edu.vn/wp-content/uploads/2025/02/casc2.jpg",
            content:
                "Hành trình học trực tuyến từ năm 2016 chương trình MBA và sau đó tiếp bước lựa chọn DBA của tôi luôn được hỗ trợ và đồng hành bởi đội ngũ của Viện IDEAS. Có thể học online là sự lựa chọn phù hợp cho tôi để sắp xếp giữa công việc và gia đình. Lời cảm ơn sâu sắc của tôi gửi đến Dr. Pham Quang Vinh và đội ngũ hỗ trợ IDEAS, đã luôn động viên, nhắc nhở trong suốt chặng đường dài này",
        },
        {
            name: "Chu Hoàng Thái",
            title:
                "Thạc Sĩ QTKD Thụy Sĩ (Executive MBA) – Swiss UMEF Director Of Housekeeping – REGENT PHU QUOC",
            avatar:
                "https://ideas.edu.vn/wp-content/uploads/2025/02/chu_hoang_thai.jpg",
            content:
                "Lựa chọn chương trình EMBA của Swiss UMEF – hỗ trợ bởi IDEAS là một quyết định đúng đắn đối với tôi, vì nó thuận tiện cho việc vừa đi học vừa đi làm cũng như phù hợp về khả năng tài chính của tôi. Ngoài kiến thức từ các Giáo sư Thụy sĩ và châu âu, giá trị lớn nhất đối với tôi là mạng lưới quan hệ (networking)",
        },
    ],
    school: {
        "Swiss UMEF": {
            link: "https://www.swiss-umef.ch/en",
            logo: "https://ideas.edu.vn/wp-content/uploads/2025/07/2-MBA-European-Online-Ranking-1.webp",
            small_logo:
                "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcShSoIjIIW_XlfCq3nbCxt--s3zt2lxrO74_A&amp;s",
        },
        "Ascencia Business School": {
            link: "https://www.ascencia-business-school.com/en/",
            logo: "https://ideas.edu.vn/wp-content/uploads/2024/03/Logo-Ascencia-Business-School-1.png",
            small_logo:
                "https://ideas.edu.vn/wp-content/new_public/data_imgs/Ascencia-Favicon.png",
        },
        "College de Paris": {
            link: "https://www.collegedeparis.fr/",
            logo: "https://www.collegedeparis.fr/wp-content/uploads/2021/06/cdp-formation-continue.png",
            small_logo:
                "https://ideas.edu.vn/wp-content/new_public/data_imgs/Ascencia-Favicon.png",
        },
        "Estiam & RB College": {
            link: "https://www.estiam.education/",
            logo: "https://ideas.edu.vn/wp-content/uploads/2025/03/estiam.png",
            small_logo:
                "https://ideas.edu.vn/wp-content/uploads/2025/10/small_estiam.webp",
        },
    },
    partner: [
        {
            name: "ChiefAI",
            link: "#",
            logo: "https://chiefaiofficer.vn/wp-content/uploads/2024/09/cao-logo.png",
        },
        {
            name: "ChiefAI",
            link: "#",
            logo: "https://ideas.edu.vn/wp-content/uploads/2023/07/tssac-2.webp",
        },
        {
            name: "ChiefAI",
            link: "#",
            logo: "https://ideas.edu.vn/wp-content/uploads/2023/07/Untitled-design-1-e1657270193979.webp",
        },
        {
            name: "ChiefAI",
            link: "#",
            logo: "https://ideas.edu.vn/wp-content/uploads/2023/07/1646029406269.webp",
        },
        {
            name: "ChiefAI",
            link: "#",
            logo: "https://ideas.edu.vn/wp-content/uploads/2025/03/estiam.png",
        },
    ],
    faq: [
        {
            q: "Đây có phải là chương trình liên kết đào tạo giữa Viện IDEAS và các Trường không?",
            a: "<b>Không,</b> <br/>Khi bắt đầu học một chương trình bạn sẽ chính thức là sinh viên của trường. Viện IDEAS không trực tiếp liên kết đào tạo với các trường mà đóng vai trò cầu nối, là đơn vị tư vấn và hỗ trợ học thuật trong suốt quá trình học và nhận bằng. <br/> <br/> IDEAS giúp học viên tiếp cận các <b>chương trình chính thức</b> từ các trường đại học quốc tế, đồng thời hỗ trợ trong suốt quá trình học và giúp giải quyết các vấn đề phát sinh (nếu có) để đảm bảo học viên có trải nghiệm học tập hiệu quả và thuận lợi nhất. <br/> Toàn bộ chương trình học, bằng cấp và chứng chỉ đều do các trường cấp trực tiếp và có <b>chứng nhận hợp pháp hoá lãnh sự của Đại sứ quán Việt Nam</b> ở quốc gia có trụ sở chính của trường.",
        },
        {
            q: "Viện IDEAS có tổ chức lớp học trực tiếp không hay chỉ hỗ trợ học online?",
            a: "Các chương trình do Viện IDEAS hỗ trợ chủ yếu được triển khai theo hình thức học trực tuyến, giúp học viên linh hoạt về thời gian và địa điểm. Tuy nhiên, IDEAS cũng thường xuyên tổ chức các buổi workshop, lớp chuyên đề và sự kiện kết nối trực tiếp để học viên có thể giao lưu và học hỏi thêm.",
        },
        {
            q: "Về tính pháp lý và công nhận tại Việt Nam?",
            a: "Trường Swiss UMEF hiện được ghi nhận trên hệ thống Swiss ENIC (Thụy Sĩ) và có thông tin hiện diện trên hệ thống VN-NARIC (Trung tâm công nhận văn bằng thuộc Bộ Giáo dục & Đào tạo Việt Nam). Tuy nhiên, cần lưu ý rõ về hình thức đào tạo: Theo quy định hiện hành, chương trình học Online 100% chưa thuộc diện được công nhận văn bằng tại Việt Nam(thường áp dụng cho nhu cầu thi tuyển công chức, viên chức nhà nước). Giải pháp: Trường hợp Anh/ Chị có nhu cầu bắt buộc phải được công nhận tại Việt Nam, học viên cần tham gia học trực tiếp tại Thụy Sĩ kết hợp Online theo tỷ lệ quy định: 70 % trực tiếp – 30 % online."
        },
    ],
};
const IDEAS_TEST = {
    MBA: [
        {
            id: 1,
            q: "Trình độ tiếng Anh của bạn như thế nào?",
            a: [
                "Nghe, nói, đọc, viết tốt, có thể học bằng tiếng Anh mà không gặp khó khăn",
                "Có thể đọc hiểu tài liệu tiếng Anh nhưng nghe nói chưa tốt lắm",
                "Chưa tốt, cần học chương trình có hỗ trợ tiếng Việt",
            ],
        },
        {
            id: 2,
            q: "Mục tiêu trong quản lý doanh nghiệp",
            a: [
                "Tôi muốn tìm hiểu về AI để áp dụng vào công việc",
                "Tôi muốn tập trung vào quản lý và lãnh đạo chuyên sâu",
            ],
        },
        {
            id: 3,
            q: "Bạn có định hướng học tiếp lên Tiến sĩ không?",
            a: [
                "Có, tôi muốn học lên DBA sau khi hoàn thành chương trình",
                "Chưa có kế hoạch, tôi chỉ muốn nâng cao kỹ năng quản lý",
            ],
        },
        {
            id: 4,
            q: "Bạn có thể tham gia học online vào buổi tối không?",
            a: [
                "Có thể học vào buổi tối các ngày trong tuần",
                "Khó sắp xếp thời gian học buổi tối, chỉ có thể học linh hoạt",
            ],
        },
        {
            id: 5,
            q: "Bạn mong muốn lớp học Online như thế nào?",
            a: [
                "Xem qua các video và tài liệu, hoàn thành bài tập theo quy định",
                "Muốn lớp học tương tác trực tiếp, được trao đổi và thảo luận cùng Giảng viên và học viên",
            ],
        },
    ],
};

document.addEventListener("DOMContentLoaded", () => {
    let lastScrollTop = 0;
    const header = document.querySelector(".ideas_header");

    window.addEventListener("scroll", function () {
        let scrollTop = window.scrollY || document.documentElement.scrollTop;

        if (scrollTop > 100 && scrollTop > lastScrollTop) {
            // Cuộn xuống và đã vượt 100px -> Ẩn header
            header.classList.add("hide");
        } else if (scrollTop < lastScrollTop) {
            // Cuộn lên -> Hiện header
            header.classList.remove("hide");
        }

        lastScrollTop = scrollTop;
    });

    const STORAGE_KEY = "recentPages";
    const MAX_HISTORY = 5;

    function savePageHistory() {
        let history = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];

        // Thêm trang hiện tại vào CUỐI danh sách (thay vì đầu danh sách)
        history.push(window.location.href);

        // Giữ tối đa 5 trang, xóa phần tử ĐẦU tiên nếu quá giới hạn
        if (history.length > MAX_HISTORY) {
            history.shift();
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    }

    function getPageHistory() {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    }

    // Lưu lịch sử khi trang load hoặc người dùng điều hướng
    window.addEventListener("load", savePageHistory);
    window.addEventListener("popstate", savePageHistory);

    (function setFbcFromFbclid() {
        const urlParams = new URLSearchParams(window.location.search);
        const fbclid = urlParams.get("fbclid");
        if (!fbclid) return;

        // Kiểm tra nếu cookie _fbc chưa tồn tại thì mới set
        const hasFbc = document.cookie
            .split(";")
            .some((c) => c.trim().startsWith("_fbc="));
        if (!hasFbc) {
            const fbc = `fb.1.${Date.now()}.${fbclid}`;
            document.cookie = `_fbc=${fbc}; path=/; max-age=7776000`; // 90 ngày
        }
    })();

    const ideas_alert_title = document.querySelector(".ideas_alert h3");
    const ideas_alert_close = document.querySelectorAll(".ideas_alert_close");
    const ideas_form_textarea = document.querySelector(".ideas_form_textarea");
    const ideas_media_popup_title = document.querySelector(
        ".ideas_media_popup h3",
    );
    const ideas_media_popup = document.querySelector(".ideas_media_popup");
    const test_btn = document.querySelector(".test_btn");

    const ideas_alert_content = document.querySelector(".ideas_alert_content");
    const ideas_header_menu_i = document.querySelector(".ideas_header_menu i");
    const ideas_media_content = document.querySelector(".ideas_media_content");
    const ideas_alert = document.querySelector(".ideas_alert");
    const ideas_form_choose_list = document.querySelector(
        ".ideas_form_choose ul",
    );
    const ideas_form = document.querySelector(".ideas_form");
    const ideas_form_choose_text = document.querySelector(
        ".ideas_form_choose_text",
    );
    const ideas_form_choose_span = document.querySelector(
        ".ideas_form_choose span",
    );
    const ideas_form_header_title = document.querySelector(
        ".ideas_form_header h2",
    );
    const ideas_form_choose = document.querySelector(".ideas_form_choose");
    const ideas_form_close = document.querySelector(".ideas_form_close");
    const comparebtns = document.querySelectorAll(".compare_course");
    const compare_block_title = document.querySelectorAll(".compare_block h3");
    const compare_block_imgs = document.querySelectorAll(".compare_block img");
    const comparebtns_container = document.querySelector(".compare_render > div");
    const compareActive = document.querySelector(".compare_active");
    const compare = document.querySelector(".compare");
    const compare_close = document.querySelector(".compare_close");
    const compare_btn = document.querySelector(".compare_btn");
    const test_fixed_btn = document.querySelector(".test_fixed_btn");
    const test_fixed_btn2 = document.querySelector(".test_fixed_btn2");
    const testContainer = document.querySelector("#test");
    const testQuestion = testContainer.querySelector(".test_q");
    const testAnswers = testContainer.querySelector(".test_a");
    const test_head_close = testContainer.querySelector(".test_container > i");
    const testBackBtn = testContainer.querySelector(".test_btns p:first-child");
    const testInner = testContainer.querySelector(".test_inner");
    const testProgressInner = document.querySelector(".test_progress_inner"); // Lấy progress bar từ HTML
    const ideas_header_right = document.querySelector(".ideas_header_right");
    const ideas_popup_overlay = document.querySelector(".ideas_popup_overlay");
    const ideas_popup_event = document.querySelector(".ideas_popup_event");
    ideas_popup_overlay.addEventListener("click", () => {
        ideas_popup_event && ideas_popup_event.classList.remove("active");
    });

    // ??????
    let compareID = 0;
    let program1 = null;
    let program2 = null;
    showform = function showForm(text, text2) {
        ideas_form.classList.add("active");
        ideas_form_choose_text.textContent = text || "Tư vấn chung";
        if (text2) {
            ideas_form_choose_text.textContent = text2 || "Tư vấn chung";
            ideas_form_textarea.textContent = text2;
        }
    };
    ideas_form_choose.addEventListener("click", () => {
        ideas_form_choose.classList.toggle("active");
    });

    ideas_header_menu_i.addEventListener("click", () => {
        ideas_header_right.classList.toggle("active");

        if (ideas_header_menu_i.classList.contains("fa-bars")) {
            ideas_header_menu_i.classList.replace("fa-bars", "fa-xmark");
        } else {
            ideas_header_menu_i.classList.replace("fa-xmark", "fa-bars");
        }
    });

    ideas_alert_close.forEach((btn) => {
        btn.addEventListener("click", () => {
            ideas_alert && ideas_alert.classList.remove("active");
            ideas_media_popup && ideas_media_popup.classList.remove("active");
        });
    });
    ideas_form_close.addEventListener("click", () => {
        ideas_form.classList.remove("active");
    });

    ideas_form_choose_list.addEventListener("click", (event) => {
        const clickedItem = event.target.closest("li"); // Kiểm tra nếu click vào <li>
        if (clickedItem) {
            ideas_form_choose_span.textContent = clickedItem.textContent.trim(); // In ra nội dung của <li>
        }
    });

    comparebtns_container.innerHTML = "";

    Object.entries(IDEAS_DATA.programmes).forEach(([id, program]) => {
        const div = document.createElement("div");
        div.className = "compare_item";
        div.innerHTML = `
      <div><h5>${program.name}</h5></div>
      <div>
        <div>
          <img src="${IDEAS_DATA.school[program.school].small_logo}" alt="${program.school
            }">
          <span>${program.school}</span>
        </div>
      </div>
    `;

        // Gán sự kiện click
        div.onclick = () => handleCompareClick(program);

        comparebtns_container.appendChild(div);
    });

    compare_close.addEventListener("click", () => {
        compare.classList.remove("active");
        compareActive.classList.remove("active");
        comparebtns[0].classList.remove("chosed");
        comparebtns[1].classList.remove("chosed");
        compare_block_title[0].textContent = "Chương trình 1";
        compare_block_title[1].textContent = "Chương trình 2";
        program1 = null;
        program2 = null;
    });
    compare_btn.addEventListener("click", () => {
        const h1 = document.querySelector("h1");
        let ID;
        h1 && (ID = h1.dataset.program);

        if (ID) {
            comparePopup(ID);
        } else {
            comparePopup();
        }
    });
    test_fixed_btn.addEventListener("click", () => {
        testContainer.classList.add("active");
        renderQuestion(0);
    });
    test_fixed_btn2 &&
        test_fixed_btn2.addEventListener("click", () => {
            testContainer.classList.add("active");
            renderQuestion(0);
        });
    comparePopup = function showCompare(ID) {
        console.log(123);

        compare.classList.add("active");
        if (ID) {
            const program = IDEAS_DATA.programmes[ID];
            if (!program) {
                return;
            }
            program1 = program;
            compare_render.classList.remove("active");
            comparebtns[0].classList.add("chosed");
            compare_block_title[0].textContent = program.name;
            compare_block_imgs[0].src = program.avatar;
        }
    };
    function handleCompareClick(program) {
        compare_render.classList.remove("active");
        if (compareID === 0) {
            program1 = program;
        } else {
            program2 = program;
        }
        if (program1 === program2) {
            const content = `
      <i class="fa-solid fa-clone main_clr"></i>
      <p>Hãy chọn 2 chương trình khác nhau</p>
      `;
            renderAlert("So sánh chương trình", content);
            comparebtns[compareID].classList.remove("chosed");
        } else {
            comparebtns[compareID].classList.add("chosed");
            compare_block_title[compareID].textContent = program.name;
            compare_block_imgs[compareID].src = program.avatar;
            if (program1 && program2) {
                renderComparison();
            }
        }
    }
    function renderComparison() {
        compareActive.innerHTML = `
      <div>
        <p>${program1.school}</p>
        <p>Trường</p>
        <p>${program2.school}</p>
      </div>
      <div>
        <p>${program1.country}</p>
        <p>Quốc gia</p>
        <p>${program2.country}</p>
      </div>
      <div>
        <p>${program1.description}</p>
        <p>Thông tin</p>
        <p>${program2.description}</p>
      </div>
      <div>
        <p>${program1.duration}</p>
        <p>Thời gian dự kiến</p>
        <p>${program2.duration}</p>
      </div>
       <div>
        <p>${program1.subjects}</p>
        <p>Tổng môn học</p>
        <p>${program2.subjects}</p>
      </div>
       <div>
        <p>${program1.highlight[2] || "N/A"}</p>
        <p>Thời gian</p>
        <p>${program2.highlight[2] || "N/A"}</p>
      </div>
      <div>
        <p>${program1.highlight[0] || "N/A"}</p>
        <p>Hình thức</p>
        <p>${program2.highlight[0] || "N/A"}</p>
      </div>
      <div>
        <p>${program1.highlight[1] || "N/A"}</p>
        <p>Cấp độ</p>
        <p>${program2.highlight[1] || "N/A"}</p>
      </div>
      <div>
        <p>${program1.highlight[3] || "N/A"}</p>
        <p>Hỗ trợ</p>
        <p>${program2.highlight[3] || "N/A"}</p>
      </div>
         <div>
       
          <p >
          ${program1.experience.map((exp) => `<span>${exp}</span>`).join("")}
        </p>
        <p>Yêu cầu</p>
        <p >
          ${program2.experience.map((exp) => `<span>${exp}</span>`).join("")}
        </p>
      </div>
      <div>
        <p><b>${program1.fee_course.find((f) => f.name === "Standard")?.price || "N/A"
            }</b></p>
        <p>Standard</p>
        <p><b>${program2.fee_course.find((f) => f.name === "Standard")?.price || "N/A"
            }</b></p>
      </div>
      <div>
        <p><b>${program1.fee_course.find((f) => f.name === "High Quality")?.price ||
            "N/A"
            }</b></p>
        <p>High Quality</p>
        <p><b>${program2.fee_course.find((f) => f.name === "High Quality")?.price ||
            "N/A"
            }</b></p>
      </div>
      <div class="compare_subjects">
        <p >
          ${program1.this_subjects
                .map((subject) => `<span>${subject.name}</span>`)
                .join("")}
        </p>
        <p>Danh sách môn học</p>
       <p >
          ${program2.this_subjects
                .map((subject) => `<span>${subject.name}</span>`)
                .join("")}
        </p>
      </div>
      <div>
        <p><a class="main_btn" href="${program1.link}">Xem chương trình</a></p>
        <p></p>
        <p><a class="main_btn" href="${program2.link}">Xem chương trình</a></p>
      </div>
    `;
        compareActive.classList.add("active");
        compareActive
            .querySelector("div:first-child")
            .scrollIntoView({ behavior: "smooth", block: "start" });
    }

    const compare_render = document.querySelector(".compare_render");
    const test_result_wrapper = document.querySelector(".test_result_wrapper");
    const tuvan_btn = document.querySelector(".tuvan_btn");
    comparebtns &&
        comparebtns.forEach((item, index) => {
            item.addEventListener("click", () => {
                compareID = index;
                compare_render.classList.add("active");
                compareActive.classList.remove("active");
            });
        });
    renderAlert = function renderAlert(title, contents) {
        ideas_alert.classList.add("active");
        ideas_alert_title.innerHTML = title;
        ideas_alert_content.innerHTML = contents;
    };
    renderMedia = function renderMedia(title, content) {
        ideas_media_popup_title.textContent = title;
        ideas_media_content.innerHTML = content;
        ideas_media_popup.classList.add("active");
    };
    /// TEST

    let currentQuestionIndex = 0;
    test_head_close.addEventListener("click", () => {
        testContainer.classList.remove("active");
        testInner.classList.remove("show");
        currentQuestionIndex = 0;
    });
    tuvan_btn.addEventListener("click", () => {
        showform();
    });
    const questions = IDEAS_TEST.MBA;
    let userAnswers = new Array(questions.length).fill(null);

    function updateProgress() {
        const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
        testProgressInner.style.width = `${progress}%`;
    }

    function renderQuestion(index) {
        testInner.classList.add("fade");
        setTimeout(() => {
            testInner.classList.remove("fade");
        }, 500);
        const questionData = questions[index];
        if (!questionData) return;

        testQuestion.textContent = questionData.q;
        testAnswers.innerHTML = questionData.a
            .map(
                (answer, i) =>
                    `<p data-index="${i}" class="${userAnswers[index] === i ? "selected" : ""
                    }">${answer}</p>`,
            )
            .join("");

        // Gán sự kiện click cho mỗi đáp án
        testAnswers.querySelectorAll("p").forEach((answer) => {
            answer.addEventListener("click", (e) => {
                userAnswers[index] = parseInt(e.target.dataset.index);
                nextQuestion();
            });
        });

        // Ẩn nút "Trở lại" nếu ở câu đầu tiên
        testBackBtn.classList.toggle("disable", index === 0);

        updateProgress(); // Cập nhật thanh tiến trình
    }
    testBackBtn.addEventListener("click", prevQuestion);
    function prevQuestion() {
        if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
            renderQuestion(currentQuestionIndex);
        }
    }
    function nextQuestion() {
        if (currentQuestionIndex < questions.length - 1) {
            currentQuestionIndex++;
            renderQuestion(currentQuestionIndex);
        } else {
            showResult();
        }
    }

    function showResult() {
        console.log(userAnswers);
        let matchedPrograms = [IDEAS_DATA.programmes["IDEAS02"]];
        let type = "high";

        if (userAnswers[4] === 0) {
            type = "stand";
            matchedPrograms = [
                IDEAS_DATA.programmes["IDEAS02"],
                IDEAS_DATA.programmes["IDEAS03"],
            ];
        }

        if (userAnswers[4] === 1 && userAnswers[0] === 0) {
            matchedPrograms = [
                IDEAS_DATA.programmes["IDEAS02"],
                IDEAS_DATA.programmes["IDEAS03"],
            ];
        }

        if (userAnswers[1] === 0 && userAnswers[0] === 0) {
            matchedPrograms = [IDEAS_DATA.programmes["IDEAS04"]];
        }

        if (
            userAnswers[0] === 0 &&
            userAnswers[1] === 1 &&
            userAnswers[2] === 1 &&
            userAnswers[3] === 0 &&
            userAnswers[4] === 1
        ) {
            matchedPrograms = [IDEAS_DATA.programmes["IDEAS03"]];
        }
        if (userAnswers[0] === 2) {
            type = "high";
            matchedPrograms = [IDEAS_DATA.programmes["IDEAS02"]];
        }
        if (
            userAnswers[0] === 0 &&
            userAnswers[1] === 0 &&
            userAnswers[2] === 0 &&
            userAnswers[3] === 0 &&
            userAnswers[4] === 0
        ) {
            type = "stand";
            matchedPrograms = [
                IDEAS_DATA.programmes["IDEAS02"],
                IDEAS_DATA.programmes["IDEAS03"],
            ];
        }

        testBackBtn.classList.add("disable");
        testInner.classList.add("show");
        test_result_wrapper.innerHTML = `
      <div class="test_loading">
        <p>🔄 Đang phân tích câu trả lời của bạn...</p>
      </div>
    `;

        setTimeout(() => {
            test_result_wrapper.innerHTML = `
        <div class="test_result">
          <h3>️🎉 Chương trình phù hợp với bạn có thể là:</h3>
          <div class="test_result_inner">
            ${matchedPrograms
                    .map(
                        (program) => `
              <div class="test_result_item">
                <img src="${program.avatar}" />
                <div class="test_result_item_info">
                  <p>${program.name} ${type == "high" ? "" : "- Standard"}</p>
                  <span>${`${program.school} - ${program.country}`}</span>
                  <ul>
                    ${program.test[type]
                                .map(
                                    (desc) =>
                                        `<li><i class="fa-solid fa-star"></i> ${desc}</li>`,
                                )
                                .join("")}
                  </ul>
                  <div class="test_result_item_info_btns">
                    <a href="${program.link
                            }"><i class="fa-solid fa-graduation-cap"></i> Chi tiết chương trình</a>
                    <a onclick="comparePopup('IDEAS01')" class="sub"><i class="fa-solid fa-clone"></i> So sánh</a>
                  </div>
                </div>
              </div>
            `,
                    )
                    .join("")}
          </div>
        </div>
      `;
        }, 800);
    }

    // Xử lý nút "Trở lại"
    test_btn &&
        test_btn.addEventListener("click", () => {
            testContainer.classList.add("active");
            renderQuestion(0);
        });

    const form = document.querySelector(".ideas_form form");
    const submitBtn = document.querySelector(".ideas_form_submit");
    function getUserAgentInfo() {
        let ua = navigator.userAgent;
        let os = "Unknown OS";
        let browser = "Unknown Browser";

        // Xác định hệ điều hành
        if (/Windows NT 10/.test(ua)) os = "Windows 10";
        else if (/Windows NT 6.3/.test(ua)) os = "Windows 8.1";
        else if (/Windows NT 6.2/.test(ua)) os = "Windows 8";
        else if (/Windows NT 6.1/.test(ua)) os = "Windows 7";
        else if (/Mac OS X/.test(ua)) os = "macOS";
        else if (/Android/.test(ua)) os = "Android";
        else if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";

        // Xác định trình duyệt
        if (/Chrome/.test(ua)) browser = "Chrome";
        else if (/Safari/.test(ua) && !/Chrome/.test(ua)) browser = "Safari";
        else if (/Firefox/.test(ua)) browser = "Firefox";
        else if (/Edge/.test(ua)) browser = "Edge";
        else if (/MSIE|Trident/.test(ua)) browser = "Internet Explorer";

        return `${os} | ${browser}`;
    }

    submitBtn.addEventListener("click", async function (event) {
        event.preventDefault();
        submitBtn.disabled = true;

        const ct =
            document.querySelector(".ideas_form_choose_text")?.textContent || "";
        const name = document.getElementById("name")?.value.trim();
        const email = document.getElementById("email")?.value.trim();
        const phone = document.getElementById("phone")?.value.trim();
        const degree = document.getElementById("degree")?.value.trim();
        const message = document.getElementById("text_area")?.value.trim();

        // Regex kiểm tra email
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

        // Regex kiểm tra số điện thoại VN (10 số, bắt đầu từ 0) hoặc số quốc tế (+84...)
        const phoneRegex = /^(0[1-9][0-9]{8}|\+84[1-9][0-9]{8})$/;

        // Kiểm tra từng phần tử
        if (!name) {
            submitBtn.disabled = false;
            renderAlert("Lỗi nhập liệu", `<p>Vui lòng nhập tên.</p>`);
            return;
        }
        if (!email) {
            submitBtn.disabled = false;
            renderAlert("Lỗi nhập liệu", `<p>Vui lòng nhập email.</p>`);
            return;
        }
        if (!emailRegex.test(email)) {
            submitBtn.disabled = false;
            renderAlert("Lỗi nhập liệu", `<p>Email không hợp lệ.</p>`);
            return;
        }
        if (!phone) {
            submitBtn.disabled = false;
            renderAlert("Lỗi nhập liệu", `<p>Vui lòng nhập số điện thoại.</p>`);
            return;
        }
        if (!phoneRegex.test(phone)) {
            submitBtn.disabled = false;
            renderAlert(
                "Lỗi nhập liệu",
                `<p>Số điện thoại không hợp lệ. Phải là số Việt Nam (VD: 098xxxxxxx hoặc +8498xxxxxxx).</p>`,
            );
            return;
        }
        if (!degree) {
            submitBtn.disabled = false;
            renderAlert("Lỗi nhập liệu", `<p>Vui lòng chọn học vấn hiện tại</p>`);
            return;
        }

        const history = localStorage.getItem("recentPages");
        let agent = getUserAgentInfo();
        let user_info = `Device: ${agent}`;
        let city = "Không rõ";
        let country = "Không rõ";
        submitBtn.textContent = "Đang gửi..";
        if (typeof gtag_report_conversion === "function") {
            gtag_report_conversion();
        }
        submitToGoogleForm(
            name,
            email,
            phone,
            degree,
            message,
            ct,
            history,
            user_info,
        );
        sendFacebookEvent(email, name, city, country, phone, agent);
    });

    // Hàm hash dữ liệu (SHA-256)
    async function hashData(data) {
        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest(
            "SHA-256",
            encoder.encode(data.trim().toLowerCase()),
        );
        return Array.from(new Uint8Array(hashBuffer))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
    }

    // Gửi sự kiện lên Facebook Conversion API
    async function sendFacebookEvent(email, name, city, country, phone) {
        const pixelId = "661260709828887";
        // [SEC-05] Removed hardcoded Facebook CAPI token from client-side bundle
        const accessToken = (typeof window !== "undefined" && window.__IDEAS_FB_CAPI_TOKEN__) ? window.__IDEAS_FB_CAPI_TOKEN__ : "";
        if (!accessToken) return;

        // Lấy _fbc từ cookie nếu có
        function getFbc() {
            const cookies = document.cookie.split(";");
            for (const cookie of cookies) {
                const trimmed = cookie.trim();
                if (trimmed.startsWith("_fbc=")) {
                    return trimmed.substring(5);
                }
            }
            return null;
        }

        const hashedEmail = await hashData(email);
        const hashedFirstName = await hashData(name);
        const hashedCity = await hashData(city);
        const hashedCountry = await hashData(country);
        const hashedPhone = await hashData(phone);
        const fbc = getFbc();
        const eventId = crypto.randomUUID();

        const eventData = {
            data: [
                {
                    event_name: "CompleteRegistration",
                    event_time: Math.floor(Date.now() / 1000),
                    event_source_url: window.location.href,
                    action_source: "website",
                    event_id: eventId,
                    user_data: {
                        em: [hashedEmail],
                        fn: [hashedFirstName],
                        ct: [hashedCity],
                        country: [hashedCountry],
                        ph: [hashedPhone],
                        fbc: [fbc],
                        ...(fbc && { fbc }), // thêm nếu có
                    },
                },
            ],
        };

        try {
            const response = await fetch(
                `https://graph.facebook.com/v18.0/${pixelId}/events?access_token=${accessToken}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(eventData),
                },
            );

            const result = await response.json();
            console.log("Facebook Conversion API Response:", result);
        } catch (error) {
            console.error("Lỗi khi gửi dữ liệu lên Facebook:", error);
        }
    }

    // Gửi sự kiện lên Google Ads Enhanced Conversions
    function submitToGoogleForm(
        name,
        email,
        phone,
        degree,
        message,
        ct,
        history,
        user_info,
    ) {
        const formURL =
            "https://docs.google.com/forms/u/0/d/e/1FAIpQLScBHl6dpxHpe-jC1xnJNn1rttuS772PMV55lVJNlGmhTIOj9g/formResponse";

        const formData = new FormData();
        formData.append("entry.1751148659", name); // Thay entry.xxx bằng đúng ID
        formData.append("entry.1873304847", email);
        formData.append("entry.1901052569", phone);
        formData.append("entry.533788886", degree);
        formData.append("entry.411126909", message);
        formData.append("entry.808554546", ct);
        formData.append("entry.955397374", history);
        formData.append("entry.864156184", user_info);

        fetch(formURL, {
            method: "POST",
            body: formData,
            mode: "no-cors",
        })
            .then(() => {
                submitBtn.disabled = false;
                const content = ` <i class="fa-solid fa-circle-check"></i>
            <span
              >Cảm ơn bạn đã quan tâm về ${ct}, tư vấn viên sẽ liên hệ cho bạn trong thời
              gian sớm nhất</span
            >`;
                renderAlert("Thành công", content);
                ideas_form.classList.remove("active");
                document.querySelector("form").reset();
                submitBtn.textContent = "Đăng ký tư vấn";
                setTimeout(() => {
                    window.location.href = "https://ideas.edu.vn/";
                }, 2000);
            })
            .catch(() => {
                submitBtn.textContent = "Đăng ký tư vấn";
                alert("Có lỗi xảy ra, vui lòng thử lại!");
            });
    }
});